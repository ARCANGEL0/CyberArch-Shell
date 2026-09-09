import GLib from "gi://GLib"
import { execAsync } from "astal"
import { USER_DIR } from "../../env.ts"


export type WmVal = boolean | number | string

const DEF: Record<string, WmVal> = {
 wmOpacity: true, wmOpacityVal: 0.88, wmOpacityMode: "off", wmOpacityApps: "",
 wmGlow: true, wmGlowRange: 14, wmGlowRp: 3, wmShadow: true,
 wmShadowColor: "", wmShadowAlpha: 38, wmShadowRange: 16,
 wmBorders: true, wmBorderSize: 1, wmBorderColor: "",
 wmCorners: "round", wmRounding: 10,
}
const WM: Record<string, WmVal> = { ...DEF }
const Touched: Record<string, boolean> = {}

const WM_PATH = `${USER_DIR}/wm_config.lua`
const WM_KEYS = Object.keys(DEF)

export const CORNER_OPTS = ["round", "bevel", "sharp"]
export const CORNER_LABEL: Record<string, string> = { round: "ROUNDED", bevel: "BEVELED", sharp: "SHARP" }
export const OPACITY_MODES = ["off", "only", "except"]
export const OPACITY_MODE_LABEL: Record<string, string> = { off: "GLOBAL ONLY", only: "ONLY SELECTED APPS", except: "ALL EXCEPT SELECTED" }

const changeBus: Array<() => void> = []
export const onWmChange = (cb: () => void): (() => void) => {
 changeBus.push(cb)
 return () => { const i = changeBus.indexOf(cb); if (i >= 0) changeBus.splice(i, 1) }
}
const notifyWmChange = () => { for (const cb of [...changeBus]) { try { cb() } catch (e) { print("[wm] notify:", e) } } }

export const wmBool = (k: string): boolean => WM[k] === true
export const wmNum = (k: string): number => typeof WM[k] === "number" ? WM[k] as number : DEF[k] as number
export const wmStr = (k: string): string => typeof WM[k] === "string" ? WM[k] as string : ""
export const wmIsDefault = (k: string): boolean => WM[k] === DEF[k]


const loadWmConfig = (): void => {
 try {
     if (!GLib.file_test(WM_PATH, GLib.FileTest.EXISTS)) return
     const [ok, bytes] = GLib.file_get_contents(WM_PATH)
     if (!ok) return
     for (const line of new TextDecoder().decode(bytes).split("\n")) {
         const t = /t\["(\w+)"\]\s*=\s*true/.exec(line)
         if (t && WM_KEYS.includes(t[1])) { Touched[t[1]] = true; continue }
         const m = /wm\["(\w+)"\]\s*=\s*(true|false|"([^"]*)"|-?\d+(?:\.\d+)?)/.exec(line)
         if (!m || !WM_KEYS.includes(m[1])) continue
         if (typeof DEF[m[1]] === "boolean") WM[m[1]] = m[2] === "true"
         else if (typeof DEF[m[1]] === "number") WM[m[1]] = parseFloat(m[2])
         else { if (m[3] === undefined) continue; WM[m[1]] = m[3] }
     }
 } catch (e) { print("[wm] load:", e) }
}
const saveWmConfig = (): void => {
 try {
     let out = "local wm = {}\nlocal t = {}\n"
     for (const k of WM_KEYS) {
         const v = WM[k]
         out += typeof v === "boolean" ? `wm["${k}"] = ${v}\n`
             : typeof v === "number" ? `wm["${k}"] = ${v}\n`
             : `wm["${k}"] = "${String(v).replace(/"/g, "")}"\n`
         if (Touched[k]) out += `t["${k}"] = true\n`
     }
     out += "return { wm = wm, t = t }\n"
     GLib.file_set_contents(WM_PATH, out)
 } catch (e) { print("[wm] save:", e) }
}


const hex2rgb = (h: string): [number, number, number] | null => {
 if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
 return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const hx = (v: number) => Math.round(v).toString(16).padStart(2, "0")

export const wmCornersIs = (v: string): boolean => wmStr("wmCorners") === v

const readShellColors = (): Record<string, string> => {
 const out: Record<string, string> = {}
 try {
     const p = `${USER_DIR}/shell_colors.lua`
     if (!GLib.file_test(p, GLib.FileTest.EXISTS)) return out
     const [ok, bytes] = GLib.file_get_contents(p)
     if (!ok) return out
     for (const line of new TextDecoder().decode(bytes).split("\n")) {
         const m = /(\w+)\s*=\s*("?)([0-9a-fA-F.]+)\2/.exec(line)
         if (m) out[m[1]] = m[3]
     }
 } catch {}
 return out
}

export const applyWmLive = (): void => {
 const sc = hex2rgb(wmStr("wmShadowColor"))
 const bc = hex2rgb(wmStr("wmBorderColor"))
 const theme = readShellColors()
 const ta = hex2rgb(theme.accent || "")
 const ta2 = hex2rgb(theme.accent2 || theme.accent || "")
 const b1 = bc || ta
 const b2 = bc || ta2 || ta
 const glowOn = wmBool("wmGlow") && wmBool("wmBorders")
 const op = wmBool("wmOpacity") ? wmNum("wmOpacityVal") : 1
 const alpha = Math.round(wmNum("wmShadowAlpha") * 2.55)
 let round = Math.round(wmNum("wmRounding"))
 if (wmCornersIs("sharp")) round = 0
 if (round < 0) round = 0
 if (round > 40) round = 40
 const power = wmCornersIs("bevel") ? 1 : 2
 let conf = `general={border_size=${wmBool("wmBorders") ? wmNum("wmBorderSize") : 0}`
 if (b1 && b2) {
     conf += `,col={active_border={colors={"rgba(${hx(b1[0])}${hx(b1[1])}${hx(b1[2])}ff)","rgba(${hx(b2[0])}${hx(b2[1])}${hx(b2[2])}ff)"},angle=45},inactive_border="rgba(${hx(b1[0])}${hx(b1[1])}${hx(b1[2])}44)"}`
 }
 conf += `},decoration={rounding=${round},rounding_power=${power},active_opacity=${op},inactive_opacity=${Math.max(0.5, op - 0.08).toFixed(2)}`
 conf += `,glow={enabled=${glowOn}`
 if (sc) conf += `,color="rgba(${hx(sc[0])}${hx(sc[1])}${hx(sc[2])}ff)"`
 conf += `,range=${wmNum("wmGlowRange")},render_power=${wmNum("wmGlowRp")}}`
 conf += `,shadow={enabled=${wmBool("wmShadow")},range=${wmNum("wmShadowRange")},render_power=${wmNum("wmGlowRp")}`
 if (sc) conf += `,color="rgba(${hx(sc[0])}${hx(sc[1])}${hx(sc[2])}${alpha.toString(16).padStart(2, "0")})"`
 const ic = sc || bc
 if (ic) conf += `,color_inactive="rgba(${hx(ic[0])}${hx(ic[1])}${hx(ic[2])}18)"`
 conf += `}}`
 execAsync(["hyprctl", "eval", `hl.config({${conf}})`]).catch(() => {})
}


const RULE_TAG = "cyberarch-wm"

const ruleLua = (cls: string, op: number): string =>
 `hl.window_rule({ name = "${RULE_TAG}", match = { class = "${cls}" }, opacity = ${op} })`

export const applyWmRules = (): void => {
 const mode = wmStr("wmOpacityMode")
 const apps = wmStr("wmOpacityApps").split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
 if (mode === "off" || !wmBool("wmOpacity") || apps.length === 0) return
 const op = wmNum("wmOpacityVal")
 const jobs: string[] = []
 for (const app of apps) {
     const c = app.replace(/["\\]/g, "")
     if (!c) continue
     const cls = mode === "only" ? `(?i)^${c}$` : `(?i)^((?!${c}).)*$`
     jobs.push(`h[#h+1] = ${ruleLua(cls, op)}`)
 }
 if (jobs.length === 0) return
 execAsync(["hyprctl", "eval", `local h = {}; ${jobs.join(" ")}; return "ok"`]).catch(() => {})
}

export const setWm = (k: string, v: WmVal): void => {
 if (!(k in DEF) || WM[k] === v) return
 if (typeof v === "number" && typeof DEF[k] === "number" && Number.isInteger(DEF[k] as number)) v = Math.round(v)
 WM[k] = v
 Touched[k] = true
 saveWmConfig()
 if (OPACITY_KEYS.includes(k)) applyWmRules()
 if (LIVE_KEYS.includes(k)) applyWmLive()
 notifyWmChange()
}
export const toggleWm = (k: string): void => { setWm(k, WM[k] !== true) }
export const resetWm = (keys: string[]): void => {
 let hit = false
 for (const k of keys) if (k in DEF && (WM[k] !== DEF[k] || Touched[k])) { WM[k] = DEF[k]; Touched[k] = false; hit = true }
 if (!hit) return
 saveWmConfig()
 applyWmRules()
 applyWmLive()
 notifyWmChange()
}

const OPACITY_KEYS = ["wmOpacity", "wmOpacityVal", "wmOpacityMode", "wmOpacityApps"]
const LIVE_KEYS = OPACITY_KEYS.concat(["wmGlow", "wmGlowRange", "wmGlowRp", "wmShadow",
 "wmShadowColor", "wmShadowAlpha", "wmShadowRange", "wmBorders", "wmBorderSize",
 "wmBorderColor", "wmCorners", "wmRounding"])

export const applyWmFromTheme = (): void => {
 const sc = readShellColors()
 if (Object.keys(sc).length === 0) return
 if (!Touched["wmGlowRange"] && sc.glow_range) setWmSilent("wmGlowRange", parseInt(sc.glow_range, 10))
 if (!Touched["wmShadowRange"] && sc.glow_range) setWmSilent("wmShadowRange", parseInt(sc.glow_range, 10))
 if (!Touched["wmGlowRp"] && sc.glow_rp) setWmSilent("wmGlowRp", parseInt(sc.glow_rp, 10))
 if (!Touched["wmRounding"] && sc.rounding) setWmSilent("wmRounding", parseInt(sc.rounding, 10))
 if (!Touched["wmCorners"] && sc.rounding_power) setWmSilent("wmCorners", parseFloat(sc.rounding_power) < 1.5 ? "bevel" : "round")
 applyWmLive()
}
const setWmSilent = (k: string, v: WmVal): void => {
 if (!(k in DEF) || typeof v !== typeof DEF[k]) return
 if (typeof v === "number" && isNaN(v)) return
 WM[k] = v
}

loadWmConfig()
