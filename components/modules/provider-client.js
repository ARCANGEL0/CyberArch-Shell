// HTTP, persistent storage and time are public system boundaries.
export const retryDelay=(header,failures,at)=>{
 const seconds=/^\d+$/.test(String(header||'').trim())?Number(header):Math.max(0,(Date.parse(header)-at)/1000);
 return Math.min(86400000,Math.max(Number.isFinite(seconds)?seconds*1000:0,Math.min(3600000,60000*2**Math.min(6,Math.max(0,failures-1)))));
};
export const createProviderClient=({fetch,store,now=()=>Date.now()})=>{
 const pending=new Map(),queues=new Map();
 const get=(provider,url,{maxAge=60,validate=()=>true,parse=JSON.parse}={})=>{
  const key=`${provider}:${url}`;if(pending.has(key))return pending.get(key);
  const previous=queues.get(provider)||Promise.resolve();let release;
  queues.set(provider,new Promise(resolve=>{release=resolve}));
  const job=(async()=>{
   await previous;
   try{
    const cached=await store.read(key),meta=await store.read(`${provider}:status`)||{},requestMeta=await store.read(`${key}:status`)||{};
    let good=false;try{good=cached&&Number.isFinite(cached.updatedAt)&&cached.updatedAt<=now()&&validate(cached.value)}catch{}
    const fallback=(error,retryAt=0)=>({provider,value:good?cached.value:null,updatedAt:good?cached.updatedAt:null,
     state:good?(now()-cached.updatedAt>maxAge*1000?'stale':'cached'):(retryAt>now()?'rate-limited':'error'),error:String(error||''),retryAt});
    if(meta.retryAt>now())return fallback(meta.error,meta.retryAt);
    if(requestMeta.retryAt>now())return fallback(requestMeta.error,requestMeta.retryAt);
    if(good&&!meta.error&&now()-cached.updatedAt<maxAge*1000)return fallback('');
    let response;
    try{
     response=await fetch(url);
     if(response.status<200||response.status>=300)throw Error(`HTTP ${response.status}`);
     const value=parse(response.body);if(!validate(value))throw Error('Invalid provider payload');
     const updatedAt=now();await store.write(key,{value,updatedAt});await store.write(`${provider}:status`,{failures:0,retryAt:0,error:''});if(requestMeta.error||requestMeta.retryAt)await store.write(`${key}:status`,{failures:0,retryAt:0,error:''});
     return {provider,value,updatedAt,state:'live',error:'',retryAt:0};
    }catch(error){
     const providerFailure=!response||response.status===429||response.status>=500;
     const statusKey=providerFailure?`${provider}:status`:`${key}:status`;
     const previous=providerFailure?meta:requestMeta;
     const failures=Math.min(7,(previous.failures||0)+1),retryAt=now()+retryDelay(response?.headers?.['retry-after'],failures,now());
     await store.write(statusKey,{failures,retryAt,error:String(error)});
     return fallback(error,retryAt);
    }
   }finally{release()}
  })().finally(()=>pending.delete(key));
  pending.set(key,job);return job;
 };
 return {get};
};
export const deduplicateNews=(rows)=>{const seen=new Set();return rows.filter(row=>{const key=String(row.url||row.title||'').replace(/[?#].*$/,'').toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true})};
