import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { execAsync } from "astal"
import { createProviderClient } from "./provider-client.js"

const directory=`${GLib.get_user_cache_dir()}/cyberarch/providers`
const path=(key:string)=>`${directory}/${GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256,key,-1)}.json`
const store={read(key:string){try{const [ok,bytes]=GLib.file_get_contents(path(key));return ok?JSON.parse(new TextDecoder().decode(bytes)):null}catch{return null}},
 write(key:string,value:any){GLib.mkdir_with_parents(directory,0o700);Gio.File.new_for_path(path(key)).replace_contents(new TextEncoder().encode(JSON.stringify(value)),null,false,Gio.FileCreateFlags.REPLACE_DESTINATION,null)}}
const fetchResponse=async(url:string)=>{
 const [headerFd,headersPath]=GLib.file_open_tmp("cyberarch-provider-headers-XXXXXX"),[bodyFd,bodyPath]=GLib.file_open_tmp("cyberarch-provider-body-XXXXXX")
 GLib.close(headerFd);GLib.close(bodyFd)
 try{
  const code=await execAsync([GLib.getenv("CYBERARCH_HTTP_CLIENT")||"curl","-sSL","--max-time","10","-H","User-Agent: CyberArch-Shell","-D",headersPath,"-o",bodyPath,"-w","%{http_code}",url])
  const [,headerBytes]=GLib.file_get_contents(headersPath),[,bodyBytes]=GLib.file_get_contents(bodyPath)
  if(bodyBytes.length>8388608)throw Error("Provider response exceeds the cache limit")
  const headers:any={};new TextDecoder().decode(headerBytes).split(/\r?\n/).forEach(line=>{const index=line.indexOf(":");if(index>0)headers[line.slice(0,index).toLowerCase()]=line.slice(index+1).trim()})
  return {status:Number(code.trim()),headers,body:new TextDecoder().decode(bodyBytes)}
 }finally{GLib.unlink(headersPath);GLib.unlink(bodyPath)}
}
const client=createProviderClient({fetch:fetchResponse,store})
export const providerResults:Record<string,any>={}
export const providerText=(name:string)=>{const s=providerResults[name];return s?`${name}: ${s.state.toUpperCase()}${s.updatedAt===null?'':` · ${Math.max(0,Math.floor((Date.now()-s.updatedAt)/1000))}s old`}${s.error?` · ${s.error}`:''}`:`${name}: NOT REQUESTED`}
export const requestProvider=async(name:string,url:string,options:any={})=>{
 const result=await client.get(options.group||name,url,options);providerResults[name]=result;return result
}
export const jsonProvider=async(name:string,url:string,options:any={})=>{
 const result=await requestProvider(name,url,options);if(result.value===null)throw Error(result.error||`${name} unavailable`);return result.value
}
