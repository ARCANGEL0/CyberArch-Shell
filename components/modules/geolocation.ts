import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { locateOnce } from "./location-policy.js"

const proxy=(path:string,iface:string):Promise<any>=>new Promise((resolve,reject)=>Gio.DBusProxy.new_for_bus(
 Gio.BusType.SYSTEM,Gio.DBusProxyFlags.NONE,null,"org.freedesktop.GeoClue2",path,iface,null,(_s,result)=>{
  try{resolve(Gio.DBusProxy.new_for_bus_finish(result))}catch(error){reject(error)}
 }))
const call=(p:any,method:string,parameters:any=null):Promise<any>=>new Promise((resolve,reject)=>p.call(
 method,parameters,Gio.DBusCallFlags.NONE,5000,null,(_p,result)=>{try{resolve(p.call_finish(result).deep_unpack())}catch(error){reject(error)}}))
const wait=()=>new Promise(resolve=>GLib.timeout_add(GLib.PRIORITY_DEFAULT,250,()=>{resolve(null);return GLib.SOURCE_REMOVE}))

export const locateCity=async(consent:boolean,active:()=>boolean=()=>true)=>{
 let manager:any=null,client:any=null
 if(!consent) return locateOnce({consent:false,available:false,provider:()=>null})
 try{manager=await proxy("/org/freedesktop/GeoClue2/Manager","org.freedesktop.GeoClue2.Manager")}catch{throw Error("GeoClue is unavailable; select a city manually")}
 return locateOnce({consent,available:true,provider:async()=>{
  try{
   const [path]=await call(manager,"GetClient");client=await proxy(path,"org.freedesktop.GeoClue2.Client")
   const props=await proxy(path,"org.freedesktop.DBus.Properties")
   await call(props,"Set",new GLib.Variant("(ssv)",["org.freedesktop.GeoClue2.Client","DesktopId",new GLib.Variant("s","cyberarch")]))
   await call(props,"Set",new GLib.Variant("(ssv)",["org.freedesktop.GeoClue2.Client","RequestedAccuracyLevel",new GLib.Variant("u",4)]))
   await call(client,"Start")
   for(let i=0;i<40;i++){
    if(!active())throw Error("Location request cancelled")
    const location=String(client.get_cached_property("Location")?.deep_unpack()||"/")
    if(location!=="/"){const p=await proxy(location,"org.freedesktop.GeoClue2.Location");return {
     lat:Number(p.get_cached_property("Latitude")?.deep_unpack()),lon:Number(p.get_cached_property("Longitude")?.deep_unpack()),name:"Detected location",full:"Detected location"}}
    await wait()
   }
   throw Error("GeoClue timed out; select a city manually")
  }finally{if(client)try{await call(client,"Stop")}catch{}}
 }})
}
