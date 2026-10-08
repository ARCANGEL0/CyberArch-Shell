import Gio from "gi://Gio"
import { execAsync } from "astal"
import { readNetwork } from "./network-policy.js"

const proxy=(path:string,iface:string):Promise<any>=>new Promise((resolve,reject)=>Gio.DBusProxy.new_for_bus(
 Gio.BusType.SYSTEM,Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES,null,"org.freedesktop.NetworkManager",path,iface,null,
 (_s,result)=>{try{resolve(Gio.DBusProxy.new_for_bus_finish(result))}catch(error){reject(error)}}))
const prop=(p:any,key:string)=>p.get_cached_property(key)?.deep_unpack()

const dbusSnapshot=async()=>{
 const manager=await proxy("/org/freedesktop/NetworkManager","org.freedesktop.NetworkManager")
 const connectivity=Number(prop(manager,"Connectivity")||0),path=String(prop(manager,"PrimaryConnection")||"/")
 if(path==="/")return {connected:false,connectivity}
 const active=await proxy(path,"org.freedesktop.NetworkManager.Connection.Active")
 const connection=String(prop(active,"Id")||""),connectionType=String(prop(active,"Type")||"")
 const type=connectionType.includes("wireless")?"wifi":connectionType.includes("ethernet")?"ethernet":"other"
 const paths=prop(active,"Devices")||[]
 let iface="",ssid="",signal=0
 if(paths.length){
  const device=await proxy(paths[0],"org.freedesktop.NetworkManager.Device");iface=String(prop(device,"Interface")||"")
  if(type==="wifi"){
   const wireless=await proxy(paths[0],"org.freedesktop.NetworkManager.Device.Wireless")
   const accessPoint=String(prop(wireless,"ActiveAccessPoint")||"/")
   if(accessPoint!=="/"){const ap=await proxy(accessPoint,"org.freedesktop.NetworkManager.AccessPoint");signal=Number(prop(ap,"Strength")||0);ssid=new TextDecoder().decode(new Uint8Array(prop(ap,"Ssid")||[]))}
  }
 }
 return {connected:Number(prop(active,"State"))===2,connectivity,type,interface:iface,ssid,signal,connection}
}
const nmcliSnapshot=async()=>{
 const text=await execAsync(["nmcli","--escape","no","-t","-f","DEVICE,TYPE,STATE","device"])
 const row=text.split("\n").map(line=>line.split(":" )).find(cols=>cols[2]?.startsWith("connected")&&cols[1]!=="loopback")
 if(!row)return {connected:false}
 const [iface,type]=row
 const connectivity=({full:4,limited:3,portal:2,none:1} as any)[(await execAsync(["nmcli","-g","CONNECTIVITY","general"])).trim()]||0
 let ssid="",signal=0
 if(type==="wifi"){
  const access=await execAsync(["nmcli","--escape","no","-t","-f","IN-USE,SSID,SIGNAL","device","wifi","list","ifname",iface,"--rescan","no"])
  const active=access.split("\n").find(line=>line.startsWith("*:"))
  if(active){const end=active.lastIndexOf(":");ssid=active.slice(2,end);signal=Number(active.slice(end+1))||0}
 }
 return {connected:true,connectivity,type,interface:iface,ssid,signal}
}
export const readNetworkSnapshot=()=>readNetwork({dbus:dbusSnapshot,nmcli:nmcliSnapshot})
