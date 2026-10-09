export const networkState = (value={}) => {
 const link=Boolean(value.connected),kind=value.type==='wifi'?'wifi':value.type==='ethernet'?'ethernet':'other';
 const internet=link?({1:'link-only',2:'portal',3:'limited',4:'internet'}[value.connectivity]||'unknown'):'offline';
 const signal=kind==='wifi'?Math.max(0,Math.min(100,Number(value.signal)||0)):0;
 const ssid=kind==='wifi'?String(value.ssid||''):'';
 const name=ssid||String(value.connection||value.interface||'Connected');
 const prefix=kind==='wifi'?'WiFi':kind==='ethernet'?'Ethernet':'Network';
 const label=link?`${prefix}: ${name}${signal?` · ${signal}%`:''}${internet==='internet'?'':` · ${internet.toUpperCase()}`}`:'DISCONNECTED';
 return {link,kind,interface:String(value.interface||''),ssid,signal,internet,label};
};
export const readNetwork=async({dbus,nmcli})=>{try{return networkState(await dbus())}catch{try{return networkState(await nmcli())}catch{return networkState()}}};
export const trafficRate=(before,after)=>{
 if(!before||!after?.interface||before.interface!==after.interface||after.at<=before.at||after.rx<before.rx||after.tx<before.tx)return {up:0,down:0};
 const seconds=(after.at-before.at)/1000;
 return {up:(after.tx-before.tx)/seconds,down:(after.rx-before.rx)/seconds};
};
