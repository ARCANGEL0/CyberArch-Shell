import test from 'node:test';import assert from 'node:assert/strict';
import { networkState, readNetwork, trafficRate } from '../components/modules/network-policy.js';
test('connected Wi-Fi with a captive portal is not falsely offline',()=>{
 assert.deepEqual(networkState({connected:true,type:'wifi',interface:'wlp1',ssid:'Café:Net',signal:64,connectivity:2}),
  {link:true,kind:'wifi',interface:'wlp1',ssid:'Café:Net',signal:64,internet:'portal',label:'WiFi: Café:Net · 64% · PORTAL'});
});
test('interface changes reset traffic counters instead of reporting a spike',()=>{
 const before={interface:'wifi0',rx:1000,tx:2000,at:1000};
 assert.deepEqual(trafficRate(before,{interface:'eth0',rx:100000,tx:200000,at:2000}),{up:0,down:0});
 assert.deepEqual(trafficRate(before,{interface:'wifi0',rx:2000,tx:2500,at:2000}),{up:500,down:1000});
});
test('D-Bus failure falls back without inventing internet connectivity',async()=>{
 const value=await readNetwork({dbus:async()=>{throw Error('unavailable')},nmcli:async()=>({connected:true,type:'ethernet',interface:'eth0',connectivity:3})});
 assert.equal(value.internet,'limited');assert.equal(value.interface,'eth0');
});
