import GLib from "gi://GLib"
import { requestProvider } from "../components/modules/providers.ts"
const options={maxAge:0,validate:(value:any)=>Number.isFinite(value.price)},url="https://fixture/prices"
if(GLib.getenv("PROVIDER_RESTART_TEST")==="1"){
 const result=await requestProvider("Fixture",url,options);if(result.value?.price!==42||result.retryAt<Date.now())throw Error("Restart lost cached value/backoff")
 print("PASS: GJS restart preserves provider cache and retry window")
}else{
 const live=await requestProvider("Fixture",url,options);if(live.state!=="live"||live.value.price!==42)throw Error(JSON.stringify(live))
 GLib.setenv("PROVIDER_FIXTURE_MODE","limited",true)
 const limited=await requestProvider("Fixture",url,options);if(limited.value?.price!==42||limited.retryAt<Date.now()+100000)throw Error(JSON.stringify(limited))
 print("PASS: real GJS transport caches valid values and honors HTTP Retry-After")
}
