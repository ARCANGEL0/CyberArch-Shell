










import { App, Window, Box } from "./components/modules/widget.ts"
import { Anchor, Layer, Exclusivity } from "./components/modules/widget.ts"
import { execAsync, timeout, interval } from "astal"
import AstalNotifd from "gi://AstalNotifd"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=3.0"
import { COMPONENTS_DIR, CYBER_DIR, SCREEN_WIDTH, SCREEN_HEIGHT } from "./env.ts"
import { loadUserColors } from "./components/modules/colors.ts"
import { Monitors, setWorkspaceBadge } from "./components/modules/monitors.ts"
import { SidePanel, openCityModal, openForecastModal } from "./components/modules/sidepanel.ts"
import { MarketsPanel, openMarketsModal } from "./components/modules/markets.ts"
import { openTimeModal } from "./components/modules/timeset.ts"
import { Toggles, HorizDock } from "./components/modules/dock.ts"
import { OsdWindow } from "./components/modules/osd.ts"
import { NotifPopupWindow, notifReadCurrent, notifDismiss } from "./components/modules/notifpopup.ts"
import { NotifHudWindow, toggleNotifHud, dismissAll, isDetailView } from "./components/modules/notifmessages.ts"
import {
 WsAnimWindow, triggerWsSwitch, BannerWindow, triggerShutter,
 RecWindow, RecGlitchWindow, RecFrameWindow, setRecording, passthrough, registerHudWindows,
 isRecording, toggleHudDuringRec,
} from "./components/modules/anim.ts"
import { RegionWindow, triggerRegion, triggerRecordRegion } from "./components/modules/region.ts"
import { ToastWindow, showToast } from "./components/modules/toast.ts"
import { setTextHalo } from "./components/modules/proj.ts"
import { CModalWindows, toggleModal } from "./components/modules/cmodal.ts"
import { AurBarWindow, dismissAurBar, showInstalled } from "./components/modules/aurbar.ts"
import { LauncherWindow } from "./components/modules/launcher.ts"
import { AppsMenuWindow, openAppsMenu } from "./components/modules/appsmenu.ts"
import { PlayerWindow, togglePlayer } from "./components/modules/player.ts"
import { NowPlayingWindow } from "./components/modules/nowplaying.ts"

const SCSS = `${COMPONENTS_DIR}/style/cyber.scss`
const CSS = `${COMPONENTS_DIR}/style/cyber.css`

const compileCss = async () => {
 try {
 await execAsync(["sassc", SCSS, CSS])
 App.apply_css(CSS, true)
 } catch (e) { print("[cyberpunk] sassc:", e) }
}

const hudWins = []
const surface = (mon, name, anchor, child, extra = {}) => {
 const w = Window({
 name,
 className: `aug ${name}`,
 gdkmonitor: mon,
 anchor,
 exclusivity: Exclusivity.IGNORE,
 layer: Layer.BOTTOM,
 child: Box({ className: `aug-wrap ${name}-wrap`, child }),
 ...extra,
 })
 hudWins.push(w)
 return w
}

let hudOnTop = false

const Cairo = (imports as any).cairo
const shapedRegion = (win, rectFill) => {
 try {
 if (win.get_realized?.() === false || win.get_mapped?.() === false) return null
 const w = win.get_allocated_width?.() || 0, h = win.get_allocated_height?.() || 0
 if (w < 1 || h < 1) return null
 const surf = new Cairo.ImageSurface(Cairo.Format.ARGB32, w, h)
 const cr = new Cairo.Context(surf)
 if (rectFill) { cr.setSourceRGBA(1, 1, 1, 1); cr.rectangle(0, 0, w, h); cr.fill() }
 else {
 win.draw(cr)



 const tmp = new Cairo.ImageSurface(Cairo.Format.ARGB32, w, h)
 const ct = new Cairo.Context(tmp); ct.setSourceSurface(surf, 0, 0); ct.paint()
 for (let i = 0; i < 6; i++) { cr.setSourceSurface(tmp, 0, 0); cr.paint() }
 }
 const s = surfaceRect(win)
 if (s) {
 cr.setOperator(0)
 for (const r of winCache) {
 const ax = Math.max(r.x, s.x), ay = Math.max(r.y, s.y)
 const bx = Math.min(r.x + r.w, s.x + s.w), by = Math.min(r.y + r.h, s.y + s.h)
 if (bx > ax && by > ay) { cr.rectangle(ax - s.x, ay - s.y, bx - ax, by - ay); cr.fill() }
 }
 cr.setOperator(2)
 }
 surf.flush()
 return Gdk.cairo_region_create_from_surface(surf)
 } catch (e) { print("[cyberpunk] hud region:", e); return null }
}
let winCache: any[] = []
let winKey = ""
const surfaceRect = (win) => {
 try {
 const aw = win.get_allocated_width?.() || 0, ah = win.get_allocated_height?.() || 0
 if (aw < 1 || ah < 1) return null
 const a = (win.anchor as any) | 0
 if (!a) return null
 let mx = 0, my = 0, mw = SCREEN_WIDTH, mh = SCREEN_HEIGHT
 try { const g = (win as any).gdkmonitor?.get_geometry?.(); if (g) { mx = g.x; my = g.y; mw = g.width; mh = g.height } } catch {}
 const L = !!(a & Anchor.LEFT), Rr = !!(a & Anchor.RIGHT), T = !!(a & Anchor.TOP), Bm = !!(a & Anchor.BOTTOM)
 const x = mx + ((L && Rr) ? 0 : Rr ? mw - aw : L ? 0 : Math.round((mw - aw) / 2))
 const y = my + ((T && Bm) ? 0 : Bm ? mh - ah : T ? 0 : Math.round((mh - ah) / 2))
 return { x, y, w: aw, h: ah }
 } catch { return null }
}
const applyHudInput = (win) => {
 try {
 const gw = win.get_window?.(); if (!gw) return
 if (hudOnTop) {
 const aw = win.get_allocated_width?.() || 0, ah = win.get_allocated_height?.() || 0
 if (aw > 0 && ah > 0) {
 const full = new Cairo.Region()
 full.unionRectangle({ x: 0, y: 0, width: aw, height: ah })
 gw.input_shape_combine_region(full, 0, 0)
 }
 return
 }
 const r = shapedRegion(win, !!(win as any)._rectHit)
 gw.input_shape_combine_region(r || null, 0, 0)
} catch {}
}
const applyHudInputAll = () => { for (const w of hudWins) deferShape(w) }
const deferShape = (win) => {
 if (win._shapePending) return
 win._shapePending = true
 GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
 win._shapePending = false
 applyHudInput(win)
 return GLib.SOURCE_REMOVE
 })
}
const refreshWins = () => Promise.all([execAsync(["hyprctl", "clients", "-j"]), execAsync(["hyprctl", "monitors", "-j"])]).then(([co, mo]) => {
 try {
 const active = new Set<number>()
 for (const m of JSON.parse(mo)) { if (m && m.activeWorkspace && typeof m.activeWorkspace.id === "number") active.add(m.activeWorkspace.id) }
 const next = JSON.parse(co).filter((c: any) => {
 if (!c || !c.mapped || c.hidden || !c.size || !(c.size[0] > 0) || !c.at) return false
 return !!(c.workspace && active.has(c.workspace.id))
 }).map((c: any) => ({ x: c.at[0], y: c.at[1], w: c.size[0], h: c.size[1] }))
 const key = JSON.stringify(next)
 if (key !== winKey) { winKey = key; winCache = next; applyHudInputAll() }
 } catch (e) { print("[cyberpunk] refreshWins parse:", e) }
}).catch((e) => print("[cyberpunk] hyprctl failed:", e))
const EVENT_HITS = new Set(["openwindow", "closewindow", "movewindow", "workspace", "focusedmon", "fullscreen", "togglefloating", "activewindow"])
let holdOn = null
const pickRefresh = () => {
 if (holdOn) { GLib.source_remove(holdOn); holdOn = null }
 holdOn = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => { holdOn = null; refreshWins(); return false })
}
const wireSocket = () => {
 try {
 const base = `${GLib.getenv("XDG_RUNTIME_DIR") || `/run/user/${GLib.get_user_name()}`}/hypr`
 const dir = GLib.Dir.open(base, 0); if (!dir) return
 let sock = null, nm
 while ((nm = dir.read_name())) { const p = `${base}/${nm}/.socket2.sock`; if (GLib.file_test(p, GLib.FileTest.EXISTS)) { sock = p; break } }
 if (!sock) { print("[cyberpunk] hypr socket2 not found"); return }
 const client = new Gio.SocketClient()
 const conn = client.connect(new Gio.UnixSocketAddress({ path: sock }), null)
 const stream = new Gio.DataInputStream({ base_stream: conn.input_stream })
 const pump = () => stream.read_line_async(0, null, (_src, res) => {
  try {
  const [bytes] = stream.read_line_finish(res)
  if (bytes) {
  const line = bytes.toString(), ev = line.split(">>")[0], data = line.slice(ev.length + 2)
  if (ev === "workspace") setWorkspaceBadge(data.trim())
  else if (ev === "workspacev2") setWorkspaceBadge(data.split(",")[1]?.trim() || data.split(",")[0]?.trim())
  else if (ev === "focusedmon") setWorkspaceBadge(data.split(",")[1]?.trim())
  if (EVENT_HITS.has(ev)) pickRefresh()
  }
  pump()
  } catch { try { pump() } catch {} }
 })
 pump()
 } catch (e) { print("[cyberpunk] hypr socket:", e) }
}


const toggleHudTop = () => {
 hudOnTop = !hudOnTop
 setTextHalo(hudOnTop)
 const L = hudOnTop ? Layer.TOP : Layer.BOTTOM
 for (const w of hudWins) {
 try { if (typeof w.set_layer === "function") w.set_layer(L); else w.layer = L }
 catch (e) { print("[cyberpunk] hud layer:", e) }
 deferShape(w)
 try { w.queue_draw() } catch {}
 }
 if (!hudOnTop) refreshWins()
}





App.start({
 instanceName: "cyberpunk",
 requestHandler(request, res) {
 const reply = (r) => { try { res(r) } catch {} }
 if (request === "launcher") {
 execAsync(["sh", "-c", "rofi -show drun || rofi -show run"]).catch(print)
 reply("ok")
 } else if (request === "apps-menu") {
 try { openAppsMenu() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "player") {
 try { togglePlayer() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "notif-read") {
 try { notifReadCurrent() } catch (e) { print(e) }
 reply("ok")
  } else if (request === "notif-dismiss") {
  try { isDetailView() ? dismissAll() : notifDismiss() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "notif-hud") {
 try { toggleNotifHud() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "dismiss-notifs") {
 try {
 const nd = AstalNotifd.get_default()
 const list = Array.from((nd.get_notifications?.() ?? nd.notifications) ?? [])
 for (const n of list) { try { (n).dismiss() } catch {} }
 } catch (e) { print(e) }
 reply("ok")
 } else if (request.startsWith("ws-go ")) {
 try { triggerWsSwitch(request.slice(6).trim()) } catch (e) { print(e) }
 reply("ok")
 } else if (request.startsWith("shutter")) {
 try { triggerShutter(request.slice(7).trim()) } catch (e) { print(e) }
 reply("ok")
 } else if (request.startsWith("region-shot")) {
 try { triggerRegion(request.slice(11).trim()) } catch (e) { print(e) }
 reply("ok")
 } else if (request.startsWith("modal ")) {
 try { toggleModal(request.slice(6).trim()) } catch (e) { print(e) }
 reply("ok")
 } else if (request === "record-region") {
 try { triggerRecordRegion() } catch (e) { print(e) }
 reply("ok")
 } else if (request.startsWith("record-start")) {
 try {
 const nums = request.slice(12).trim().split(/\s+/).filter(s => s.length).map(Number)
 const region = nums.length >= 8 ? { x: nums[4] - nums[0], y: nums[5] - nums[1], w: nums[6], h: nums[7] } : null
 setRecording(true, nums.slice(0, 4).join(" "), region)
 } catch (e) { print(e) }
 reply("ok")
 } else if (request === "record-stop") {
 try { setRecording(false) } catch (e) { print(e) }
 reply("ok")
 } else if (request === "toggle-hud") {
 try {



 if (isRecording()) { const shown = toggleHudDuringRec(); reply(shown ? "rec-hud-on" : "rec-hud-off") }
 else { toggleHudTop(); reply(hudOnTop ? "top" : "bottom") }
 } catch (e) { print(e); reply("err") }
 } else if (request.startsWith("toast")) {
 try { showToast(request.slice(5).trim() || undefined) } catch (e) { print(e) }
 reply("ok")
 } else if (request === "weather") {
 try { openCityModal() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "forecast") {
 try { openForecastModal() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "clock") {
 try { openTimeModal() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "markets") {
 try { openMarketsModal() } catch (e) { print(e) }
 reply("ok")
 } else if (request === "aur-dismiss") {
 try { dismissAurBar() } catch (e) { print(e) }
 reply("ok")
 } else if (request.startsWith("pkg-installed ")) {
 try { const d = request.slice(14); const i = d.indexOf("|"); showInstalled(i < 0 ? d : d.slice(0, i), i < 0 ? "" : d.slice(i + 1)) } catch (e) { print(e) }
 reply("ok")
 } else reply("unknown request")
 },



 main() {
 compileCss()
 loadUserColors()

 for (const mon of (App as any).get_monitors()) {
 surface(mon, "monitors", Anchor.TOP | Anchor.LEFT, Monitors())
 { const sw = surface(mon, "sidepanel", Anchor.TOP | Anchor.RIGHT, SidePanel()); (sw as any)._rectHit = true }
 { const mw = surface(mon, "markets", Anchor.TOP | Anchor.RIGHT, MarketsPanel(), { margin_top: 560 }); (mw as any)._rectHit = true }
 { const hw = surface(mon, "hordock", Anchor.BOTTOM | Anchor.LEFT, HorizDock()); (hw as any)._rectHit = true }
 { const tw = surface(mon, "toggles", Anchor.BOTTOM | Anchor.LEFT, Toggles()); (tw as any)._rectHit = true }
 { const lw = LauncherWindow(mon); (lw as any)._rectHit = true; hudWins.push(lw) }
 }
 passthrough(OsdWindow())
 passthrough(NotifPopupWindow())
 passthrough(AurBarWindow())
 NotifHudWindow()
 NowPlayingWindow()
 WsAnimWindow()
 BannerWindow()
 RecWindow()
 RecGlitchWindow()
 RecFrameWindow()
 RegionWindow()
 ToastWindow()
 CModalWindows()
 AppsMenuWindow()
 PlayerWindow()
 registerHudWindows(hudWins)
 execAsync(["sh", "-c", `'${CYBER_DIR}/scripts/appvol-keeper'`]).catch(() => {})
 for (const w of hudWins) {
 try {
 w.connect("size-allocate", () => deferShape(w))
 w.connect("map", () => deferShape(w))
 } catch {}
 }
 timeout(400, applyHudInputAll); timeout(1200, applyHudInputAll)
 refreshWins(); wireSocket()
 execAsync(["hyprctl", "activeworkspace", "-j"]).then((s) => { try { setWorkspaceBadge(JSON.parse(s).name) } catch {} }).catch(() => {})
 interval(30000, refreshWins)
 },
})
