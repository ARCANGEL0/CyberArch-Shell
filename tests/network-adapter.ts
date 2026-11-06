import { readNetworkSnapshot } from "../components/modules/network.ts"
const snapshot=await readNetworkSnapshot()
 if(!snapshot.link||snapshot.kind!=="wifi"||snapshot.ssid!=="Fixture: Café"||snapshot.signal!==67||snapshot.internet!=="limited")throw Error(JSON.stringify(snapshot))
print("PASS: async GJS NetworkManager adapter preserves fallback SSID, signal, interface and limited connectivity")
