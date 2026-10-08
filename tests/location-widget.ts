import { App } from "../components/modules/widget.ts"
import { SidePanel, currentCity } from "../components/modules/sidepanel.ts"
import GLib from "gi://GLib"
App.start({instanceName:"track-b-location-qa",main(){
 const widget=SidePanel((App as any).get_monitors()[0]);widget.show_all()
 if(currentCity()!==null)throw Error("Fresh widget inherited a default city")
 GLib.timeout_add(GLib.PRIORITY_DEFAULT,500,()=>{print("PASS: fresh side-panel widget has honest unset location");App.quit();return false})
}})
