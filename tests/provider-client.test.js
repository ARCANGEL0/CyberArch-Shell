import test from 'node:test';import assert from 'node:assert/strict';
import { createProviderClient, retryDelay, deduplicateNews } from '../components/modules/provider-client.js';
test('an offline provider preserves last-known-good data and its age',async()=>{
 let now=1000,offline=false;const entries=new Map();
 const client=createProviderClient({now:()=>now,store:{read:key=>entries.get(key),write:(key,value)=>entries.set(key,value)},
  fetch:async()=>{if(offline)throw Error('offline');return {status:200,headers:{},body:'{"price":42}'}}});
 assert.equal((await client.get('prices','https://test/price',{maxAge:60,validate:value=>value.price>0})).state,'live');
 offline=true;now=62000;const cached=await client.get('prices','https://test/price',{maxAge:60,validate:value=>value.price>0});
 assert.equal(cached.value.price,42);assert.equal(cached.state,'stale');assert.equal(cached.updatedAt,1000);assert.match(cached.error,/offline/);
});
test('malformed success responses cannot replace the last valid price',async()=>{
 let now=1000,body='{"price":42}';const entries=new Map();
 const client=createProviderClient({now:()=>now,store:{read:key=>entries.get(key),write:(key,value)=>entries.set(key,value)},fetch:async()=>({status:200,headers:{},body})});
 const options={maxAge:1,validate:value=>Number.isFinite(value.price)};
 await client.get('prices','https://test/price',options);now=3000;body='{"error":"not a quote"}';
 const result=await client.get('prices','https://test/price',options);assert.equal(result.value.price,42);assert.equal(result.updatedAt,1000);assert.match(result.error,/invalid/i);
});
test('Retry-After dates and bounded backoff use provider time instead of immediate retries',()=>{
 assert.equal(retryDelay('120',1,0),120000);
 assert.equal(retryDelay('Thu, 01 Jan 1970 00:03:00 GMT',1,0),180000);
 assert.equal(retryDelay('',20,0),3600000);
});
test('duplicate RSS links do not reappear with tracking suffixes',()=>{
 assert.deepEqual(deduplicateNews([{url:'https://news/a?track=1',title:'A'},{url:'https://news/a#fragment',title:'Duplicate'},{url:'https://news/b',title:'B'}]).map(row=>row.title),['A','B']);
});
test('rate-limit backoff survives a new client and prevents overlapping requests',async()=>{
 let calls=0,now=1000;const entries=new Map();const dependencies={now:()=>now,
  store:{read:key=>entries.get(key),write:(key,value)=>entries.set(key,value)},
  fetch:async()=>{calls++;return {status:429,headers:{'retry-after':'120'},body:''}}};
 const client=createProviderClient(dependencies);await Promise.all([client.get('crypto','https://test/a'),client.get('crypto','https://test/a')]);
 assert.equal(calls,1);now=2000;await createProviderClient(dependencies).get('crypto','https://test/a');assert.equal(calls,1);
 now=122000;await client.get('crypto','https://test/a');assert.equal(calls,2);
});
