// read/write side for ~/.config/hypr/user.lua.. everything the keybinds tab
// shows or edits goes trough here.
// only binds with an actual combo string get picked up. the ones made in a loop
// ("CTRL + SHIFT + " .. i) get skipped on purpose, theres no fixed combo so
// nothing to draw and nothing safe to rewrite.
// args can be any lua at all (string, table, concat) so it just counts parens
// and keeps it exactly how it was written. same reason editing a bind only
// swaps the combo on that line, deleting and re-adding would throw the
// dispatcher away

import GLib from "gi://GLib"
import { execAsync } from "astal"

const HOME = GLib.get_home_dir()
const USER_LUA = `${HOME}/.config/hypr/user.lua`

export type Rebind = {
    action_id: string
    combo: string
    raw_line: number
}

export type CustomAdd = {
    label: string
    mod: string
    key: string
    kind: string
    value: string
    raw_line: number
}

export type UserBind = {
    combo: string
    dispatcher: string
    args: string | null
    argsRaw: string | null
    raw_line: number
}

export type UserLua = {
    rebinds: Rebind[]
    adds: CustomAdd[]
    customBinds: UserBind[]
    themeMod: string | null
    lines: string[]
    source: string
}

export type ThemeAction = {
    id: string
    label: string
    group: "deck" | "win" | "system"
    mod: string
    key: string
}

export type Conflict =
    | { kind: "none" }
    | { kind: "user-bind"; existing: UserBind }
    | { kind: "user-rebind"; existing: Rebind }
    | { kind: "user-add"; existing: CustomAdd }
    | { kind: "theme-default"; existing: ThemeAction }

const THEME_MOD_RE = /^CD\.themeMod\(\s*["']([^"']+)["']\s*\)/m
const REBIND_RE = /^CD\.rebind\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/
const ADD_RE = /^CD\.add\(\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*\)/
const HL_BIND_RE = /^hl\.bind\(\s*["']([^"']+)["']\s*,\s*hl\.dsp\.([a-zA-Z_.]+)\s*(.*)$/

const parseBindTail = (tail: string): { argsRaw: string | null; args: string | null } => {
    const t = tail.replace(/^\s+/, "")
    if (!t.startsWith("(")) return { argsRaw: null, args: null }
    let depth = 0
    let quote: string | null = null
    for (let i = 0; i < t.length; i++) {
        const ch = t[i]
        if (quote) {
            if (ch === quote && t[i - 1] !== "\\") quote = null
            continue
        }
        if (ch === '"' || ch === "'") { quote = ch; continue }
        if (ch === "(") { depth++; continue }
        if (ch === ")") {
            depth--
            if (depth === 0) {
                const inner = t.slice(1, i).replace(/^\s+/, "").replace(/\s+$/, "")
                if (!inner) return { argsRaw: null, args: null }
                const lit = /^(["'])([\s\S]*)\1$/.exec(inner)
                return { argsRaw: inner, args: lit ? lit[2] : null }
            }
        }
    }
    return { argsRaw: null, args: null }
}

const canon = (c: string): string => {
    const parts: string[] = []
    for (const p of (c || "").split("+")) {
        const s = p.replace(/^\s+/, "").replace(/\s+$/, "").toUpperCase()
        if (s) parts.push(s)
    }
    const ord = (x: string): number =>
        x === "SUPER" ? 1 : x === "CTRL" ? 2 : x === "ALT" ? 3 : x === "SHIFT" ? 4 : 5
    parts.sort((a, b) => {
        const oa = ord(a), ob = ord(b)
        if (oa === ob) return a < b ? -1 : a > b ? 1 : 0
        return oa - ob
    })
    return parts.join("+")
}

const parseFile = (raw: string): UserLua => {
    const lines = raw.split("\n")
    const rebinds: Rebind[] = []
    const adds: CustomAdd[] = []
    const customBinds: UserBind[] = []
    lines.forEach((line, idx) => {
        const ln = idx + 1
        const stripped = line.replace(/^\s+/, "").replace(/\s+$/, "")
        if (stripped.startsWith("--")) return
        let m = REBIND_RE.exec(stripped)
        if (m) { rebinds.push({ action_id: m[1], combo: m[2], raw_line: ln }); return }
        m = ADD_RE.exec(stripped)
        if (m) {
            adds.push({
                label: m[1], mod: m[2], key: m[3], kind: m[4], value: m[5], raw_line: ln,
            })
            return
        }
        m = HL_BIND_RE.exec(stripped)
        if (m) {
            const { argsRaw, args } = parseBindTail(m[3])
            customBinds.push({ combo: m[1], dispatcher: m[2], args, argsRaw, raw_line: ln })
        }
    })
    const tm = THEME_MOD_RE.exec(raw)
    const themeMod = tm ? tm[1] : null
    return { rebinds, adds, customBinds, themeMod, lines, source: raw }
}

export const readUserLua = (): UserLua => {
    try {
        const [ok, bytes] = GLib.file_get_contents(USER_LUA)
        if (!ok) return { rebinds: [], adds: [], customBinds: [], themeMod: null, lines: [], source: "" }
        return parseFile(new TextDecoder().decode(bytes))
    } catch {
        return { rebinds: [], adds: [], customBinds: [], themeMod: null, lines: [], source: "" }
    }
}

const THEME_ACTIONS: ThemeAction[] = [
    { id: "hud.toggle",   label: "TOGGLE HUD",          group: "deck", mod: "@themeMod", key: "Z" },
    { id: "hud.vol",      label: "VOLUME",              group: "deck", mod: "@themeMod", key: "V" },
    { id: "hud.brt",      label: "BRIGHTNESS",          group: "deck", mod: "@themeMod", key: "I" },
    { id: "hud.aur",      label: "UPDATES",             group: "deck", mod: "@themeMod", key: "U" },
    { id: "hud.aurdis",   label: "DISMISS UPDATES",     group: "deck", mod: "@themeMod", key: "J" },
    { id: "hud.notif",    label: "NOTIFICATIONS",       group: "deck", mod: "@themeMod", key: "M" },
    { id: "hud.player",   label: "MUSIC PLAYER",        group: "deck", mod: "@themeMod", key: "O" },
    { id: "hud.wifi",     label: "NETWORKS",            group: "deck", mod: "@themeMod", key: "N" },
    { id: "hud.bt",       label: "BLUETOOTH",           group: "deck", mod: "@themeMod", key: "B" },
    { id: "hud.pwr",      label: "POWER",               group: "deck", mod: "@themeMod", key: "P" },
    { id: "hud.forecast", label: "FORECAST",            group: "deck", mod: "@themeMod", key: "W" },
    { id: "hud.clock",    label: "CLOCK",               group: "deck", mod: "@themeMod", key: "minus" },
    { id: "hud.markets",  label: "MARKETS",             group: "deck", mod: "@themeMod", key: "G" },
    { id: "hud.bat",      label: "BATTERY",             group: "deck", mod: "@themeMod", key: "Y" },
    { id: "hud.sys",      label: "SYSTEM",              group: "deck", mod: "@themeMod", key: "C" },
    { id: "hud.keys",     label: "KEYBINDS",            group: "deck", mod: "@themeMod", key: "H" },
    { id: "hud.settings", label: "THEME SETTINGS",      group: "deck", mod: "@themeMod", key: "backspace" },
    { id: "hud.notifrd",  label: "READ NOTIFICATION",   group: "deck", mod: "@themeMod", key: "E" },
    { id: "hud.notifdis", label: "DISMISS NOTIFICATION",group: "deck", mod: "@themeMod", key: "X" },
    { id: "tool.rec",     label: "SCREEN RECORD",       group: "deck", mod: "@themeMod", key: "R" },
    { id: "tool.term",    label: "TERMINAL",            group: "deck", mod: "@themeMod", key: "T" },
    { id: "tool.shot",    label: "SCREENSHOT",          group: "deck", mod: "@themeMod", key: "S" },
    { id: "tool.kill",    label: "FORCE KILL",          group: "deck", mod: "@themeMod", key: "K" },
    { id: "tool.lock",    label: "LOCK SCREEN",         group: "deck", mod: "@themeMod", key: "L" },
    { id: "win.full",     label: "FULL SCREEN",         group: "win",  mod: "SUPER + SHIFT", key: "F" },
    { id: "win.float",    label: "TOGGLE FLOAT",        group: "win",  mod: "SUPER",         key: "F" },
    { id: "win.close",    label: "CLOSE WINDOW",        group: "win",  mod: "SUPER",         key: "Q" },
    { id: "win.fleft",    label: "FOCUS LEFT",          group: "win",  mod: "SUPER",         key: "left" },
    { id: "win.fright",   label: "FOCUS RIGHT",         group: "win",  mod: "SUPER",         key: "right" },
    { id: "win.fup",      label: "FOCUS UP",            group: "win",  mod: "SUPER",         key: "up" },
    { id: "win.fdown",    label: "FOCUS DOWN",          group: "win",  mod: "SUPER",         key: "down" },
    { id: "win.mleft",    label: "MOVE LEFT",           group: "win",  mod: "SUPER + SHIFT", key: "left" },
    { id: "win.mright",   label: "MOVE RIGHT",          group: "win",  mod: "SUPER + SHIFT", key: "right" },
    { id: "win.mup",      label: "MOVE UP",             group: "win",  mod: "SUPER + SHIFT", key: "up" },
    { id: "win.mdown",    label: "MOVE DOWN",           group: "win",  mod: "SUPER + SHIFT", key: "down" },
    { id: "win.rleft",    label: "RESIZE LEFT",         group: "win",  mod: "CTRL + SHIFT",  key: "left" },
    { id: "win.rright",   label: "RESIZE RIGHT",        group: "win",  mod: "CTRL + SHIFT",  key: "right" },
    { id: "win.rup",      label: "RESIZE UP",           group: "win",  mod: "CTRL + SHIFT",  key: "up" },
    { id: "win.rdown",    label: "RESIZE DOWN",         group: "win",  mod: "CTRL + SHIFT",  key: "down" },
]

export const readThemeActions = (): ThemeAction[] => THEME_ACTIONS

export const resolveCombo = (action: ThemeAction, rebinds: Rebind[], themeMod: string): string => {
    const rb = rebinds.find(r => r.action_id === action.id)
    if (rb) {
        if (rb.combo.includes("+")) {
            const parts = rb.combo.split("+").map(s => s.trim())
            const k = parts[parts.length - 1]
            const m = parts.length > 1 ? parts.slice(0, -1).join(" + ") : themeMod
            return `${m} + ${k}`
        }
        return `${themeMod} + ${rb.combo}`
    }
    const m = action.mod === "@themeMod" ? themeMod : action.mod
    return `${m} + ${action.key}`
}

export const checkConflict = (combo: string, excludeId?: string): Conflict => {
    const c = canon(combo)
    const state = readUserLua()
    const ud = state.customBinds.find(b => canon(b.combo) === c)
    if (ud) return { kind: "user-bind", existing: ud }
    const ur = state.rebinds.find(r => canon(r.combo) === c && r.action_id !== excludeId)
    if (ur) return { kind: "user-rebind", existing: ur }
    const ua = state.adds.find(a => canon(`${a.mod} + ${a.key}`) === c)
    if (ua) return { kind: "user-add", existing: ua }
    const td = THEME_ACTIONS.find(t => t.id !== excludeId && canon(`${t.mod === "@themeMod" ? "SUPER + SHIFT" : t.mod} + ${t.key}`) === c)
    if (td) return { kind: "theme-default", existing: td }
    return { kind: "none" }
}

export const themeModDefault = (): string => "SUPER + SHIFT"

const backUp = (): string => {
    const stamp = Math.floor(Date.now() / 1000)
    const dest = `${USER_LUA}.bak.${stamp}`
    try {
        const [ok, bytes] = GLib.file_get_contents(USER_LUA)
        if (ok) GLib.file_set_contents(dest, bytes)
    } catch (e) { print("[userbinds] backup failed:", e) }
    return dest
}

const writeFile = (raw: string): boolean => {
    try {
        GLib.file_set_contents(USER_LUA, new TextEncoder().encode(raw))
        return true
    } catch (e) {
        print("[userbinds] write failed:", e)
        return false
    }
}

const fmtRebind = (action_id: string, combo: string): string => `CD.rebind("${action_id}", "${combo}")`
const fmtAdd = (label: string, mod: string, key: string, kind: string, value: string): string =>
    `CD.add("${label}", "${mod}", "${key}", "${kind}", "${value}")`
const fmtBind = (combo: string, dispatcher: string, args: string | null): string => {
    if (args) return `hl.bind("${combo}", hl.dsp.${dispatcher}("${args}"))`
    return `hl.bind("${combo}", hl.dsp.${dispatcher})`
}

export type Mutation =
    | { op: "add-rebind"; action_id: string; combo: string }
    | { op: "update-rebind"; action_id: string; combo: string; old_combo: string }
    | { op: "remove-rebind"; action_id: string; combo: string }
    | { op: "add-add"; label: string; mod: string; key: string; kind: string; value: string }
    | { op: "update-add"; label: string; mod: string; key: string; kind: string; value: string; old_key: string }
    | { op: "remove-add"; label: string; mod: string; key: string }
    | { op: "add-custom"; combo: string; dispatcher: string; args: string | null }
    | { op: "update-custom"; raw_line: number; combo: string }
    | { op: "remove-custom"; raw_line: number }

export const writeUserLua = (mutations: Mutation[]): { ok: boolean; backup: string } => {
    const state = readUserLua()
    const lines = state.lines.slice()
    const ops = mutations.slice().sort((a, b) => {
        const aLine = "raw_line" in a ? a.raw_line : Number.MAX_SAFE_INTEGER
        const bLine = "raw_line" in b ? b.raw_line : Number.MAX_SAFE_INTEGER
        return bLine - aLine
    })
    for (const m of ops) {
        if (m.op === "remove-rebind") {
            const r = state.rebinds.find(x => x.action_id === m.action_id && x.combo === m.combo)
            if (r) lines.splice(r.raw_line - 1, 1)
        } else if (m.op === "update-rebind") {
            const r = state.rebinds.find(x => x.action_id === m.action_id && x.combo === m.old_combo)
            if (r) lines[r.raw_line - 1] = fmtRebind(m.action_id, m.combo)
        } else if (m.op === "add-rebind") {
            const insertAt = state.rebinds.length > 0
                ? Math.max(...state.rebinds.map(r => r.raw_line))
                : findAnchorLine(lines, "CD.rebind")
            lines.splice(insertAt, 0, fmtRebind(m.action_id, m.combo))
        } else if (m.op === "remove-add") {
            const a = state.adds.find(x => x.label === m.label && x.key === m.key)
            if (a) lines.splice(a.raw_line - 1, 1)
        } else if (m.op === "update-add") {
            const a = state.adds.find(x => x.label === m.label && x.key === m.old_key)
            if (a) lines[a.raw_line - 1] = fmtAdd(m.label, m.mod, m.key, m.kind, m.value)
        } else if (m.op === "add-add") {
            const insertAt = state.adds.length > 0
                ? Math.max(...state.adds.map(a => a.raw_line)) + 1
                : findAnchorLine(lines, "CD.add")
            lines.splice(insertAt, 0, fmtAdd(m.label, m.mod, m.key, m.kind, m.value))
        } else if (m.op === "remove-custom") {
            lines.splice(m.raw_line - 1, 1)
        } else if (m.op === "add-custom") {
            const insertAt = findAnchorLine(lines, "hl.bind")
            lines.splice(insertAt, 0, fmtBind(m.combo, m.dispatcher, m.args))
        } else if (m.op === "update-custom") {
            const i = m.raw_line - 1
            if (i >= 0 && i < lines.length) {
                lines[i] = lines[i].replace(
                    /^(\s*hl\.bind\(\s*)(["'])([^"']+)\2/,
                    (_all, head, q) => `${head}${q}${m.combo}${q}`,
                )
            }
        }
    }
    const backup = backUp()
    const ok = writeFile(lines.join("\n"))
    return { ok, backup }
}

const findAnchorLine = (lines: string[], kind: "CD.rebind" | "CD.add" | "hl.bind"): number => {
    if (lines.length === 0) return 0
    if (kind === "CD.rebind") {
        for (let i = 0; i < lines.length; i++) if (REBIND_RE.test(lines[i].replace(/^\s+/, ""))) return i
        for (let i = 0; i < lines.length; i++) if (ADD_RE.test(lines[i].replace(/^\s+/, ""))) return i
        for (let i = 0; i < lines.length; i++) if (HL_BIND_RE.test(lines[i].replace(/^\s+/, ""))) return i
        return Math.max(0, lines.length - 2)
    }
    if (kind === "CD.add") {
        for (let i = 0; i < lines.length; i++) if (ADD_RE.test(lines[i].replace(/^\s+/, ""))) return i + 1
        for (let i = 0; i < lines.length; i++) if (HL_BIND_RE.test(lines[i].replace(/^\s+/, ""))) return i
        return Math.max(0, lines.length - 2)
    }
    for (let i = 0; i < lines.length; i++) if (HL_BIND_RE.test(lines[i].replace(/^\s+/, ""))) return i
    for (let i = 0; i < lines.length; i++) if (/^hl\.window_rule\(/.test(lines[i].replace(/^\s+/, ""))) return i
    return lines.length
}

export const addRebind = (action_id: string, combo: string): { ok: boolean; backup: string } => {
    return writeUserLua([{ op: "update-rebind", action_id, combo, old_combo: combo }])
}

export const ensureRebind = (action_id: string, combo: string): { ok: boolean; backup: string } => {
    const state = readUserLua()
    const existing = state.rebinds.find(r => r.action_id === action_id)
    if (existing) {
        if (canon(existing.combo) === canon(combo)) return { ok: true, backup: "" }
        return writeUserLua([{ op: "update-rebind", action_id, combo, old_combo: existing.combo }])
    }
    return writeUserLua([{ op: "add-rebind", action_id, combo }])
}

export const removeRebind = (action_id: string): { ok: boolean; backup: string } => {
    const state = readUserLua()
    const existing = state.rebinds.find(r => r.action_id === action_id)
    if (!existing) return { ok: true, backup: "" }
    return writeUserLua([{ op: "remove-rebind", action_id, combo: existing.combo }])
}

export const addCustom = (combo: string, dispatcher: string, args: string | null = null): { ok: boolean; backup: string } =>
    writeUserLua([{ op: "add-custom", combo, dispatcher, args }])

export const removeCustom = (raw_line: number): { ok: boolean; backup: string } =>
    writeUserLua([{ op: "remove-custom", raw_line }])

export const updateCustomCombo = (raw_line: number, combo: string): { ok: boolean; backup: string } =>
    writeUserLua([{ op: "update-custom", raw_line, combo }])

const fmtThemeMod = (m: string): string => `CD.themeMod("${m}")`

export const setThemeMod = (m: string): { ok: boolean; backup: string } => {
    const state = readUserLua()
    const lines = state.lines.slice()
    if (state.themeMod === null) {
        const insertAt = lines.length > 0 ? lines.length : 0
        lines.splice(insertAt, 0, fmtThemeMod(m))
    } else {
        const re = /^CD\.themeMod\(\s*["'][^"']*["']\s*\)/
        for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i].replace(/^\s+/, ""))) {
                lines[i] = fmtThemeMod(m)
                break
            }
        }
    }
    const backup = backUp()
    const ok = writeFile(lines.join("\n"))
    return { ok, backup }
}

export const reloadHyprland = (): void => {
    execAsync(["sh", "-c", "hyprctl reload"]).catch(() => "")
}

export const userLuaPath = (): string => USER_LUA
