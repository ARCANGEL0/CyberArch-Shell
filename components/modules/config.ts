import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { execAsync } from "astal"
import { USER_DIR } from "../../env.ts"
import { setLang } from "./i18n.ts"


export type CfgVal = boolean | string

const DEF: Record<string, CfgVal> = {
 anim: true, animWorkspace: false, animGlitch: true, animModal: true,
 animGauge: true, animNotif: true, animMusic: true, animWheel: true,

 snd: true, sndNotif: true, sndNotifFile: "",
 sndWheel: true, sndWheelStart: "", sndWheelActive: "", sndWheelEnd: "",
 sndOverlay: true, sndOverlayFile: "", sndKillFile: "",

 gaugeBadge: "workspace", gaugeXp: "disk", gaugeHealth: "cpu", gaugeRam: "ram", gaugeStamina: "battery",

 // kb layout for binds
 kbLayout: "",
 lang: "en",
}
const CFG: Record<string, CfgVal> = { ...DEF }


export const SND_DIR = `${USER_DIR}/sounds`
const CFG_PATH = `${USER_DIR}/user_config.lua`
const CFG_KEYS = Object.keys(DEF)

export const METRIC_LABEL: Record<string, string> = {
 workspace: "cfg.metric.workspace",
 cpu: "cfg.metric.cpu", cputemp: "cfg.metric.cputemp",
 ram: "cfg.metric.ram", ramfree: "cfg.metric.ramfree", swap: "cfg.metric.swap",
 disk: "cfg.metric.disk", battery: "cfg.metric.battery",
 gpu: "cfg.metric.gpu", vram: "cfg.metric.vram",
 load: "cfg.metric.load", net: "cfg.metric.net",
}

const BAR_METRICS = ["cpu", "cputemp", "ram", "ramfree", "swap", "disk", "battery", "gpu", "vram", "load", "net"]

export const GAUGE_OPTS: Record<string, string[]> = {
 gaugeBadge: ["workspace", "cputemp", "cpu", "ram", "ramfree", "swap", "disk", "battery", "gpu", "load"],
 gaugeXp: BAR_METRICS, gaugeHealth: BAR_METRICS, gaugeRam: BAR_METRICS, gaugeStamina: BAR_METRICS,
}



const changeBus: Array<() => void> = []
export const onConfigChange = (cb: () => void): (() => void) => {
 changeBus.push(cb)
 return () => { const i = changeBus.indexOf(cb); if (i >= 0) changeBus.splice(i, 1) }
}
const notifyConfigChange = () => { for (const cb of [...changeBus]) { try { cb() } catch (e) { print("[cfg] notify:", e) } } }

export const cfgBool = (k: string): boolean => CFG[k] === true
export const cfgStr = (k: string): string => typeof CFG[k] === "string" ? CFG[k] as string : ""
export const cfgIsDefault = (k: string): boolean => CFG[k] === DEF[k]
export const animOn = (k: string): boolean => CFG.anim === true && CFG[k] === true
export const animMaster = (): boolean => CFG.anim === true
export const sndOn = (k: string): boolean => CFG.snd === true && CFG[k] === true

export const sndFile = (k: string, fallback: string): string => {
 const p = cfgStr(k)
 return p && GLib.file_test(p, GLib.FileTest.EXISTS) ? p : fallback
}


export const loadUserConfig = (): void => {
 try {
     if (!GLib.file_test(CFG_PATH, GLib.FileTest.EXISTS)) return
     const [ok, bytes] = GLib.file_get_contents(CFG_PATH)
     if (!ok) return
     for (const line of new TextDecoder().decode(bytes).split("\n")) {
         const m = /cfg\["(\w+)"\]\s*=\s*(true|false|"([^"]*)")/.exec(line)
         if (!m || !CFG_KEYS.includes(m[1])) continue
         if (typeof DEF[m[1]] === "boolean") { if (m[2] !== "true" && m[2] !== "false") continue; CFG[m[1]] = m[2] === "true" }
         else { if (m[3] === undefined) continue; CFG[m[1]] = m[3] }
     }
 } catch (e) { print("[cfg] load:", e) }
}
export const saveUserConfig = (): void => {
 try {
     let out = "local cfg = {}\n"
     for (const k of CFG_KEYS) {
         const v = CFG[k]
         out += typeof v === "boolean" ? `cfg["${k}"] = ${v}\n` : `cfg["${k}"] = "${String(v).replace(/"/g, "")}"\n`
     }
     out += "return cfg\n"
     GLib.file_set_contents(CFG_PATH, out)
 } catch (e) { print("[cfg] save:", e) }
}



const WS_ANIM = `hl.animation({ leaf = "workspaces", enabled = %s, speed = 4, bezier = "swiftOut", style = "slide" })`
const HYPR_KEYS = ["anim", "animWorkspace"]
const applyHyprAnim = (): void => {
 const master = CFG.anim === true, ws = master && CFG.animWorkspace === true
 execAsync(["hyprctl", "eval", `hl.config({ animations = { enabled = ${master} } }); ` + WS_ANIM.replace("%s", String(ws))]).catch(() => {})
}

// apply kb layout live no reload
const applyHyprKbLayout = (v: string): void => {
 if (v) execAsync(["hyprctl", "keyword", "input:kb_layout", v]).catch(() => {})
 else execAsync(["hyprctl", "reload"]).catch(() => {})
}
export const readHyprKbLayout = (): Promise<string> =>
 execAsync(["hyprctl", "getoption", "input:kb_layout", "-j"])
     .then(o => { try { return String(JSON.parse(o)?.str ?? "") } catch { return "" } })
     .catch(() => "")

export const setCfg = (k: string, v: CfgVal): void => {
 if (!(k in DEF) || CFG[k] === v) return
 CFG[k] = v
 saveUserConfig()
 if (HYPR_KEYS.includes(k)) applyHyprAnim()
 else if (k === "kbLayout") applyHyprKbLayout(String(v))
 else if (k === "lang") { setLang(String(v)); notifyConfigChange() }
 else notifyConfigChange()
}
export const toggleCfg = (k: string): void => { setCfg(k, CFG[k] !== true) }

export const resetCfg = (keys: string[]): void => {
 let hit = false, hypr = false, kb = false, lang = false
 for (const k of keys) if (k in DEF && CFG[k] !== DEF[k]) { CFG[k] = DEF[k]; hit = true; if (HYPR_KEYS.includes(k)) hypr = true; if (k === "kbLayout") kb = true; if (k === "lang") lang = true }
 if (!hit) return
 saveUserConfig()
 if (hypr) applyHyprAnim()
 if (kb) applyHyprKbLayout("")
 if (lang) setLang(String(CFG.lang))
 notifyConfigChange()
}


export const adoptSound = (key: string, src: string): boolean => {
 try {
     if (!src || !GLib.file_test(src, GLib.FileTest.EXISTS)) return false
     GLib.mkdir_with_parents(SND_DIR, 0o755)
     const dot = src.lastIndexOf("."), ext = dot > src.lastIndexOf("/") ? src.slice(dot) : ".ogg"
     const dst = `${SND_DIR}/${key}${ext}`
     for (const old of ["", ".ogg", ".mp3", ".wav", ".flac", ".opus", ".oga"]) {
         const p = `${SND_DIR}/${key}${old}`
         if (p !== dst && GLib.file_test(p, GLib.FileTest.EXISTS)) { try { Gio.File.new_for_path(p).delete(null) } catch {} }
     }
     Gio.File.new_for_path(src).copy(Gio.File.new_for_path(dst), Gio.FileCopyFlags.OVERWRITE, null, null)
     setCfg(key, dst)
     return true
 } catch (e) { print("[cfg] adopt:", e); return false }
}
export const clearSound = (key: string): void => { setCfg(key, "") }

loadUserConfig()
setLang(String(CFG.lang))
