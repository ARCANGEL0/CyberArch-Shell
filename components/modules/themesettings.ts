import { execAsync, timeout } from "astal"
import Gdk from "gi://Gdk?version=3.0"
import { Keymode } from "./widget.ts"
import { PALETTES, getPaletteName, applyPalette, saveUserColors, setUserColor, getUserColor, rgbToHex } from "./colors.ts"
import { TITLE, MONO, CYAN, ACC, HEADER, txt, drawGlass, Cairo } from "./glass.ts"
import { createModal, drawBtn, sectionHeader, drawKeyCap, btnPath } from "./cmodal.ts"
import { openWheel, closeWheel, buildAppEntries, openAppsMenu } from "./appsmenu.ts"
import {
    readUserLua, readThemeActions, resolveCombo, checkConflict, ensureRebind, removeRebind,
    addCustom, removeCustom, updateCustomCombo, reloadHyprland, themeModDefault, setThemeMod,
    type UserBind, type Rebind, type CustomAdd,
} from "./userbinds.ts"
import { isModKey, modsFrom, keyName, modNameOf, orderMods, canon } from "./cyberdeck.ts"

const sh = (c) => execAsync(["sh", "-c", c]).catch(() => "")
// hyprland has to be out of the way while the modal is listening for a combo,
// else it just runs whatever thats bound to and the keys never even get here.
// so capture shoves it into an empty submap and puts it back after.. released
// on cancel, save, close, and on open too incase somehting died mid capture.
// themeMod is modifiers only so that one saves when u let go, not on a press
const grabKeys = () => sh(`hyprctl dispatch 'hl.dsp.submap("cyberdeck_capture")'`)
const releaseKeys = () => sh(`hyprctl dispatch 'hl.dsp.submap("reset")'`)
let selPalette = "NETWATCH"

const readTune = () => { selPalette = getPaletteName() }

const applyColors = (name: string) => { applyPalette(name); saveUserColors(); selPalette = name }

const TABS: [string, string][] = [
    ["CONFIGURATION", "anim"], ["COLORS", "colors"], ["KEYBINDS", "keybinds"],
    ["WINDOW MANAGEMENT", "wm"], ["WALLPAPER", "wall"],
]
const TAB_BADGE: Record<string, string> = { colors: "PAL", wm: "TUNE", anim: "CFG" }
let tab = "anim"
let ctrl: any = null

const wheelEntries = () =>
    TABS.map(([label, id]) => ({ label, badge: TAB_BADGE[id] ?? "", glyph: null, data: id }))

export const ThemesCtrl = () => {
    readTune()
    ctrl = createModal({
        name: "themesettings", tabTitle: "THEME", ss: 2, W: 560, H: 860, yaw: 15, pitch: 0, roll: 0,
        anchorRight: true, noBuiltinClose: true, noGlass: true, keymode: Keymode.ON_DEMAND,
        onOpen: () => { readTune(); releaseKeys(); tab = TABS[0][1]; openWheel({ title: "THEME SETTINGS", subtitle: "// RICE.CTL :: COLOUR & WM TUNING", footer: "[ SCROLL ] SWITCH TAB   [ ESC ] CLOSE", searchable: false, onActivate: (d) => { tab = d; ctrl.requestDraw() }, onFocus: (d) => { if (tab !== d) { tab = d; ctrl.requestDraw() } }, onReset: () => ctrl.close(), emptyText: "// NO TABS" }, wheelEntries()) },
        onClose: () => {
            closeWheel()
            releaseKeys()
            kbCaptureKind = null
            kbCaptureCtx = {}
            kbCaptureLabel = ""
            kbHeld = { mods: [], modsMask: 0, key: null }
            kbCaptured = null
            kbListening = false
            kbConflict = null
            kbDeleteConfirm = null
            kbScroll = 0
        },
        onKeyRaw: onKbKeyRaw,
        onScroll: (d) => { kbScroll = Math.max(0, Math.min(kbMaxScroll, kbScroll + d * 32)); ctrl.requestDraw() },
        onKey: (k: number) => {
            if (kbCaptureKind === "newuser" && kbAddStep === "command" && k !== Gdk.KEY_Escape) {
                const name = Gdk.keyval_name(k) || ""
                if (k === Gdk.KEY_BackSpace) {
                    kbCommandText = kbCommandText.slice(0, -1)
                    ctrl.requestDraw()
                    return
                } else if (k === Gdk.KEY_Return) {
                    kbCaptureKind = "newuser"
                    kbCaptureCtx = { label: kbCommandText || "exec_cmd" }
                    kbCaptureLabel = kbCommandText || "exec_cmd"
                    kbAddStep = "capture"
                    ctrl.requestDraw()
                    return
                } else if (name && name.length === 1) {
                    kbCommandText += name
                    ctrl.requestDraw()
                    return
                } else if (name === "space") {
                    kbCommandText += " "
                    ctrl.requestDraw()
                    return
                }
            }
            if (k === Gdk.KEY_Escape && (kbCaptureKind || kbDeleteConfirm)) {
                if (kbDeleteConfirm) {
                    kbDeleteConfirm = null
                } else if (kbCaptureKind === "newuser" && (kbAddStep === "command" || kbAddStep === "app")) {
                    kbAddStep = "prompt"
                } else {
                    cancelCapture()
                }
                ctrl.requestDraw()
                return
            }
            if (kbDeleteConfirm) {
                const name = Gdk.keyval_name(k) || ""
                if (name === "y" || name === "Y" || k === Gdk.KEY_Return) {
                    const r = removeCustom(kbDeleteConfirm.raw_line)
                    kbStatus = r.ok ? { ok: true, msg: `// DELETED ${kbDeleteConfirm.combo}` } : { ok: false, msg: "// DELETE FAILED" }
                    kbDeleteConfirm = null
                    ctrl.requestDraw()
                    return
                }
                if (name === "n" || name === "N") {
                    kbDeleteConfirm = null
                    ctrl.requestDraw()
                    return
                }
            }
        },
        draw: (ctx, g) => {
            const panelX = g.X, panelW = g.w, panelY = g.Y, panelH = g.h
            drawGlass(ctx, panelX, panelY, panelW, panelH, g.col)
            txt(ctx, panelX + 16, panelY + 27, "THEME SETTINGS", TITLE, 14, g.accent, 0.98, 1, 0.45)
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.32); ctx.setLineWidth(1)
            ctx.newPath(); ctx.moveTo(panelX + 8, panelY + HEADER); ctx.lineTo(panelX + panelW - 8, panelY + HEADER); ctx.stroke()
            const x = panelX + 18, w = panelW - 36
            if (tab === "colors") drawColors(ctx, g, x, panelY + HEADER + 12, w)
            else if (tab === "keybinds") drawKeybinds(ctx, g, x, panelY + HEADER + 12, w)
            else drawWip(ctx, g, x, panelY + HEADER + 12, w)
        },
    })
    return ctrl
}

const drawColors = (ctx, g, x, y, w) => {
    sectionHeader(ctx, g, x, y, "// PALETTE", w)
    const names = Object.keys(PALETTES), cols = 4, bw = (w - (cols - 1) * 8) / cols, bh = 24, top = y + 12
    names.forEach((name, i) => {
        const bx = x + (i % cols) * (bw + 8), by = top + Math.floor(i / cols) * (bh + 6)
        drawBtn(ctx, g.push, bx, by, bw, bh, name === "NETWATCH" ? "★" + name : name, () => applyColors(name), selPalette === name, g.col)
    })
    const gridH = Math.ceil(names.length / cols) * (bh + 6)
    const lY = top + gridH + 14
    sectionHeader(ctx, g, x, lY, "// LIVE COLORS", w)
    const KEY_LABEL: [string, string][] = [
        ["red", "PRIMARY RED"], ["cyan", "ACCENT"], ["magenta", "MAGENTA"], ["green", "GREEN"],
        ["amber", "AMBER"], ["blue", "BLUE"], ["white", "WHITE"], ["dim", "DIM"], ["grid", "GRID"],
        ["dock", "DOCK"], ["press", "PRESS"], ["badge", "BADGE"], ["stamina", "STAMINA"], ["ram", "RAM"],
        ["netinfo", "NET/MARKET"],
    ]
    const rowH = 22
    KEY_LABEL.forEach(([key, label], i) => {
        const ry = lY + 8 + i * (rowH + 2)
        if (ry + rowH > y + 0) {
            const rgb = getUserColor(key)
            ctx.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 0.95)
            ctx.rectangle(x, ry, 16, 16); ctx.fill()
            txt(ctx, x + 22, ry + 12, label, TITLE, 9.5, g.accent, 0.9, 1)
            txt(ctx, x + 118, ry + 12, rgbToHex(rgb), MONO, 8.5, g.col, 0.75)
            drawHueStrip(ctx, g.push, x + w - 76, ry - 2, 76, 18, key)
        }
    })
    const footY = lY + 8 + KEY_LABEL.length * (rowH + 2) + 8
    drawBtn(ctx, g.push, x, footY, w, 28, "RESET", () => { applyPalette("NETWATCH"); saveUserColors(); readTune(); selPalette = "NETWATCH"; ctrl.requestDraw() }, false, [1, 0.4, 0.44])
}

const hueRgb = (t: number): [number, number, number] => {
    const h = ((t % 1 + 1) % 1) * 6
    const x = 1 - Math.abs(h % 2 - 1)
    const [r, gc, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x]
    return [Math.round(r * 255), Math.round(gc * 255), Math.round(b * 255)]
}
const pickHue = (key: string, t: number) => {
    setUserColor(key, hueRgb(t))
    saveUserColors()
    ctrl.requestDraw()
}
const drawHueStrip = (ctx, push, x, y, w, h, key: string) => {
    const grad = new Cairo.LinearGradient(x, 0, x + w, 0)
    for (let i = 0; i <= 6; i++) { const [r, gc, b] = hueRgb(i / 6); grad.addColorStopRGBA(i / 6, r / 255, gc / 255, b / 255, 1) }
    ctx.save(); ctx.rectangle(x, y, w, h); ctx.clip()
    ctx.setSource(grad); ctx.rectangle(x, y, w, h); ctx.fill()
    ctx.restore()
    ctx.setSourceRGBA(1, 1, 1, 0.4); ctx.setLineWidth(1); ctx.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); ctx.stroke()
    push({ kind: "sld", bx0: x, by0: y, bx1: x + w, by1: y + h, u0: x, v0: y, u1: x + w, v1: y, on: (t: number) => pickHue(key, t) })
}

type CaptureKind = "theme" | "user" | "thememod" | "newuser"
type CaptureCtx = { actionId?: string; rawLine?: number; label?: string }
type HeldState = { mods: number[]; modsMask: number; key: number | null }
type CapturedCombo = { mods: number[]; key: number; combo: string }

let kbCaptureKind: CaptureKind | null = null
let kbCaptureCtx: CaptureCtx = {}
let kbCaptureLabel: string = ""
let kbHeld: HeldState = { mods: [], modsMask: 0, key: null }
let kbCaptured: CapturedCombo | null = null
let kbListening = false
let kbConflict: { kind: "user" | "theme"; label: string; pending: { actionId?: string; combo: string; rawLine?: number; kind: CaptureKind; label?: string; comboName?: string; victimLine?: number | null } } | null = null
let kbStatus: { ok: boolean; msg: string } | null = null
let kbDeleteConfirm: { raw_line: number; combo: string; label: string } | null = null
let kbScroll = 0
let kbMaxScroll = 0
let kbAddStep: "prompt" | "command" | "app" | "capture" | null = null
let kbCommandText = ""

const ROW_H = 42
const SUB_GAP = 12
const CAP_H = 26
const SCROLL_PAD = 56
const THEMEMOD_TOP = 18

type RowEntry =
    | { kind: "thememod"; combo: string }
    | { kind: "theme"; action: import("./userbinds.ts").ThemeAction; combo: string; isRebound: boolean; subgroup: string }
    | { kind: "user-bind"; bind: UserBind; label: string; combo: string }
    | { kind: "user-add"; add: CustomAdd; label: string; combo: string }

const prettyDispatcher = (d: string): string => {
    if (d === "exec_cmd") return "CUSTOM APP"
    if (d === "exit") return "EXIT HYPRLAND"
    if (d === "layout") return "LAYOUT"
    if (d.startsWith("window.")) {
        const sub = d.split(".")[1]
        if (sub === "close") return "CLOSE WINDOW"
        if (sub === "cycle_next") return "CYCLE WINDOW"
        if (sub === "float") return "TOGGLE FLOAT"
        if (sub === "fullscreen") return "FULLSCREEN"
        if (sub === "move") return "MOVE WINDOW"
        if (sub === "resize") return "RESIZE WINDOW"
    }
    if (d.startsWith("focus")) return "FOCUS DIR"
    if (d.startsWith("workspace")) return "WORKSPACE"
    return d.toUpperCase()
}

const prettyAddKind = (k: string): string => (k || "custom").toUpperCase()

const bindDisplayLabel = (dispatcher: string, args: string | null): string =>
    dispatcher === "exec_cmd" && args
        ? ((args.split(/\s+/)[0] || args).split("/").pop() || args).toUpperCase()
        : prettyDispatcher(dispatcher)

const buildRows = (themeMod: string, userRebinds: Rebind[], customBinds: UserBind[], adds: CustomAdd[]): RowEntry[] => {
    const out: RowEntry[] = []
    out.push({ kind: "thememod", combo: themeMod })
    const actions = readThemeActions()
    for (const a of actions.filter(x => x.group === "deck")) {
        const combo = resolveCombo(a, userRebinds, themeMod)
        const isRebound = userRebinds.some(r => r.action_id === a.id)
        const subgroup = a.id.startsWith("hud.") ? "HUD" : "TOOLS"
        out.push({ kind: "theme", action: a, combo, isRebound, subgroup })
    }
    for (const a of actions.filter(x => x.group === "win")) {
        const combo = resolveCombo(a, userRebinds, themeMod)
        const isRebound = userRebinds.some(r => r.action_id === a.id)
        out.push({ kind: "theme", action: a, combo, isRebound, subgroup: "WINDOW" })
    }
    for (const b of customBinds) {
        const lbl = bindDisplayLabel(b.dispatcher, b.args)
        out.push({ kind: "user-bind", bind: b, label: lbl, combo: b.combo })
    }
    for (const a of adds) {
        const am = a.mod === "@themeMod" ? themeMod : a.mod
        const combo = am ? `${am} + ${a.key}` : a.key
        out.push({ kind: "user-add", add: a, label: a.label || prettyAddKind(a.kind), combo })
    }
    return out
}

const sectionOf = (r: RowEntry): "thememod" | "deck" | "win" | "user" => {
    if (r.kind === "thememod") return "thememod"
    if (r.kind === "theme") return r.action.group === "deck" ? "deck" : "win"
    return "user"
}

const heldToCombo = (h: HeldState): { parts: string[]; combo: string } => {
    const modNames = orderMods(h.mods.map(modNameOf).filter(Boolean))
    const k = h.key != null ? keyName(h.key) : ""
    if (!k) return { parts: modNames, combo: modNames.join(" + ") }
    if (modNames.length === 0) return { parts: [k], combo: k }
    return { parts: [...modNames, k], combo: [...modNames, k].join(" + ") }
}

const capturedToCombo = (c: CapturedCombo): string => c.combo

const startCapture = (kind: CaptureKind, ctx: CaptureCtx) => {
    kbCaptureKind = kind
    kbCaptureCtx = ctx
    kbCaptureLabel = ctx.label || ""
    kbHeld = { mods: [], modsMask: 0, key: null }
    kbCaptured = null
    if (kind === "newuser") {
        kbAddStep = "prompt"
        kbCommandText = ""
        kbListening = false
    } else {
        kbAddStep = null
        kbListening = true
    }
    kbConflict = null
    kbDeleteConfirm = null
    ctrl.requestDraw()
}

const cancelCapture = () => {
    releaseKeys()
    kbCaptureKind = null
    kbCaptureCtx = {}
    kbCaptureLabel = ""
    kbHeld = { mods: [], modsMask: 0, key: null }
    kbCaptured = null
    kbListening = false
    kbConflict = null
    ctrl.requestDraw()
}

const liveHeldAsCombo = (): string | null => {
    const c = heldToCombo(kbHeld)
    if (c.parts.length === 0) return null
    return c.combo
}

const openAppsMenuForKeybind = () => {
    openWheel({
        title: "PICK APP",
        subtitle: "// KEYBIND — SELECT AN APP",
        footer: "[ SCROLL / CLICK ] PICK   [ ESC ] BACK",
        searchable: true,
        reserveX: 600,
        onActivate: (a) => {
            const name = a?.get_name?.() || a?.label || "app"
            let cmd = ""
            try { cmd = (a?.get_commandline?.() || "").replace(/\s*%[a-zA-Z]/g, "").trim() } catch { }
            if (!cmd) { try { cmd = a?.get_executable?.() || "" } catch { } }
            closeWheel()
            kbCaptureKind = "newuser"
            kbCaptureCtx = { label: cmd || name }
            kbCaptureLabel = cmd || name
            kbAddStep = "capture"
            ctrl.requestDraw()
        },
        onFocus: () => {},
        onReset: () => { if (kbAddStep === "app") { kbAddStep = "prompt"; ctrl.requestDraw() } },
        emptyText: "// NO APPS",
    }, buildAppEntries())
}

// conflicts + replacing:
// new combo gets checked against the theme defaults AND whats already in
// user.lua, if its taken u get the prompt saying who owns it.
// REPLACE does 2 different things depending where the bind lives.. editing one
// that already exists just swaps the combo on its line, but adding a new bind
// on top of a taken combo has to delete the old line first (victimLine) or u
// end up wiht two of them and hyprland just keeps the last one.
// theme defaults dont need deleting, the scan skips em once user.lua takes it
const commitCapture = () => {
    releaseKeys()
    const combo = kbCaptured ? kbCaptured.combo : liveHeldAsCombo()
    if (!combo) {
        kbStatus = { ok: false, msg: "// press a key combo first" }
        ctrl.requestDraw()
        return
    }
    if (kbCaptureKind === "thememod") {
        const mods = orderMods(combo.split("+").map(v => v.trim().toUpperCase()))
        if (mods.length === 0) {
            kbStatus = { ok: false, msg: "// THEME KEY NEEDS SUPER / CTRL / ALT / SHIFT" }
            ctrl.requestDraw()
            return
        }
        const mc = mods.join(" + ")
        const r = setThemeMod(mc)
        kbStatus = r.ok ? { ok: true, msg: `// THEME KEY = ${mc}` } : { ok: false, msg: "// WRITE FAILED" }
        cancelCapture()
        return
    }
    if (kbCaptureKind === "theme" && kbCaptureCtx.actionId) {
        const conflict = checkConflict(combo, kbCaptureCtx.actionId)
        if (conflict.kind === "none") {
            const r = ensureRebind(kbCaptureCtx.actionId, combo)
            kbStatus = r.ok ? { ok: true, msg: `// REBOUND ${kbCaptureCtx.actionId} \u2192 ${combo}` } : { ok: false, msg: "// WRITE FAILED" }
            cancelCapture()
            return
        }
        kbConflict = {
            kind: conflict.kind === "theme-default" ? "theme" : "user",
            label: conflictKindLabel(conflict),
            pending: { actionId: kbCaptureCtx.actionId, combo, kind: "theme" },
        }
        ctrl.requestDraw()
        return
    }
    if (kbCaptureKind === "user" || kbCaptureKind === "newuser") {
        const conflict = checkConflict(combo)
        if (conflict.kind === "none") {
            if (kbCaptureKind === "user" && kbCaptureCtx.rawLine != null) {
                const ru = updateCustomCombo(kbCaptureCtx.rawLine, combo)
                kbStatus = ru.ok ? { ok: true, msg: `// REBOUND \u2192 ${combo}` } : { ok: false, msg: "// WRITE FAILED" }
                cancelCapture()
                return
            }
            const cmd = (kbCaptureLabel || "").trim()
            const r = cmd ? addCustom(combo, "exec_cmd", cmd) : addCustom(combo, "exec_cmd", null)
            kbStatus = r.ok ? { ok: true, msg: cmd ? `// ADDED ${combo} → ${cmd}` : `// ADDED ${combo}` } : { ok: false, msg: "// WRITE FAILED" }
            cancelCapture()
            return
        }
        kbConflict = {
            kind: conflict.kind === "theme-default" ? "theme" : "user",
            label: conflictKindLabel(conflict),
            pending: {
                combo, kind: kbCaptureKind, rawLine: kbCaptureCtx.rawLine, label: kbCaptureLabel,
                victimLine: (conflict as any).existing?.raw_line ?? null,
            },
        }
        ctrl.requestDraw()
    }
}

const conflictKindLabel = (c: ReturnType<typeof checkConflict>): string => {
    if (c.kind === "user-bind") return `${c.existing.combo} \u2192 ${bindDisplayLabel(c.existing.dispatcher, c.existing.args)}`
    if (c.kind === "user-rebind") return `rebind ${c.existing.action_id} (${c.existing.combo})`
    if (c.kind === "user-add") return `${c.existing.label} (${c.existing.mod} + ${c.existing.key})`
    if (c.kind === "theme-default") return c.existing.label
    return ""
}

const applyConflictReplace = () => {
    if (!kbConflict) return
    const p = kbConflict.pending
    if (p.kind === "theme" && p.actionId && p.combo) {
        const r = ensureRebind(p.actionId, p.combo)
        kbStatus = r.ok ? { ok: true, msg: `// REBOUND ${p.actionId} \u2192 ${p.combo}` } : { ok: false, msg: "// WRITE FAILED" }
    } else if ((p.kind === "user" || p.kind === "newuser") && p.combo) {
        if (p.rawLine != null) {
            const ru = updateCustomCombo(p.rawLine, p.combo)
            kbStatus = ru.ok ? { ok: true, msg: `// REBOUND \u2192 ${p.combo}` } : { ok: false, msg: "// WRITE FAILED" }
            kbConflict = null
            cancelCapture()
            return
        }
        if (p.victimLine != null) removeCustom(p.victimLine)
        const cmd = (p.label || "").trim()
        const r = cmd ? addCustom(p.combo, "exec_cmd", cmd) : addCustom(p.combo, "exec_cmd", null)
        kbStatus = r.ok ? { ok: true, msg: `// ADDED ${p.combo}` } : { ok: false, msg: "// WRITE FAILED" }
    }
    cancelCapture()
}

const onKbKeyRaw = (k: number, mask: number, isPress: boolean) => {
    if (!kbCaptureKind) return
    if (!kbListening && !kbCaptured) return
    if (k === Gdk.KEY_Escape && !isPress) {
        if (kbCaptured) { kbCaptured = null; kbHeld = { mods: [], modsMask: 0, key: null }; kbListening = false; ctrl.requestDraw() }
        else cancelCapture()
        return
    }
    const modsOnly = kbCaptureKind === "thememod"
    if (isPress) {
        if (isModKey(k)) {
            const mn = modNameOf(k)
            if (mn && !kbHeld.mods.includes(k)) kbHeld.mods.push(k)
            kbHeld.modsMask = mask
            ctrl.requestDraw()
            return
        }
        if (modsOnly) {
            kbStatus = { ok: false, msg: "// THEME KEY IS MODIFIERS ONLY" }
            ctrl.requestDraw()
            return
        }
        const name = keyName(k)
        if (!name || name === "Escape") return
        const liveMods = modsFrom(mask)
        const liveModNums: number[] = []
        const M = Gdk.ModifierType
        if (mask & (M.SUPER_MASK as any)) { liveModNums.push(Gdk.KEY_Super_L); kbHeld.mods.push(Gdk.KEY_Super_L) }
        if (mask & (M.CONTROL_MASK as any)) { liveModNums.push(Gdk.KEY_Control_L); kbHeld.mods.push(Gdk.KEY_Control_L) }
        if (mask & (M.MOD1_MASK as any)) { liveModNums.push(Gdk.KEY_Alt_L); kbHeld.mods.push(Gdk.KEY_Alt_L) }
        if (mask & (M.MOD4_MASK as any)) { liveModNums.push(Gdk.KEY_Super_L); kbHeld.mods.push(Gdk.KEY_Super_L) }
        if (mask & (M.MOD5_MASK as any)) { liveModNums.push(Gdk.KEY_Alt_L); kbHeld.mods.push(Gdk.KEY_Alt_L) }
        if (mask & (M.SHIFT_MASK as any)) { liveModNums.push(Gdk.KEY_Shift_L); kbHeld.mods.push(Gdk.KEY_Shift_L) }
        kbHeld.mods = Array.from(new Set(kbHeld.mods))
        kbHeld.key = k
        kbHeld.modsMask = mask
        const orderedModNames = orderMods(liveMods)
        const combo = orderedModNames.length > 0 ? orderedModNames.join(" + ") + " + " + name : name
        kbCaptured = { mods: liveModNums, key: k, combo }
        kbListening = false
        releaseKeys()
        ctrl.requestDraw()
    } else {
        if (isModKey(k)) {
            if (modsOnly && !kbCaptured && kbHeld.mods.length > 0) {
                const names = orderMods(kbHeld.mods.map(modNameOf).filter(Boolean))
                if (names.length > 0) {
                    kbCaptured = { mods: kbHeld.mods.slice(), key: 0, combo: names.join(" + ") }
                    kbListening = false
                    releaseKeys()
                }
            }
            kbHeld.mods = kbHeld.mods.filter(x => x !== k)
            kbHeld.modsMask = mask
            ctrl.requestDraw()
        }
    }
}

const trashT: Record<string, number> = {}
let trashPending = false

const trashHoverStep = (key: string, hot: boolean): number => {
    const cur = trashT[key] ?? 0
    const target = hot ? 1 : 0
    if (cur === target) return cur
    const next = target > cur ? Math.min(1, cur + 0.22) : Math.max(0, cur - 0.16)
    trashT[key] = next
    if (!trashPending) {
        trashPending = true
        timeout(16, () => { trashPending = false; ctrl?.requestDraw() })
    }
    return next
}

const drawTrash = (ctx, x, y, sz, col, t) => {
    const a = 0.5 + 0.5 * t
    const scale = 1 + 0.18 * t
    const lift = 2.4 * t
    const cxm = x + sz / 2, cym = y + sz / 2
    ctx.save()
    ctx.translate(cxm, cym); ctx.scale(scale, scale); ctx.translate(-cxm, -cym)
    ctx.setSourceRGBA(col[0], col[1], col[2], a)
    ctx.setLineWidth(1.15 + 0.35 * t)
    ctx.newPath(); ctx.moveTo(x, y + 3 - lift); ctx.lineTo(x + sz, y + 3 - lift); ctx.stroke()
    ctx.newPath(); ctx.moveTo(x + sz * 0.34, y - lift); ctx.lineTo(x + sz * 0.66, y - lift); ctx.stroke()
    ctx.newPath()
    ctx.moveTo(x + sz * 0.14, y + 5)
    ctx.lineTo(x + sz * 0.24, y + sz)
    ctx.lineTo(x + sz * 0.76, y + sz)
    ctx.lineTo(x + sz * 0.86, y + 5)
    ctx.stroke()
    ctx.restore()
}

const drawChipRow = (ctx, g, x, y, w, row: RowEntry, keyPrefix: string) => {
    const isThememod = row.kind === "thememod"
    const isUser = row.kind === "user-bind" || row.kind === "user-add"
    const isRebound = row.kind === "theme" && row.isRebound
    const rawLineOf: number | null = row.kind === "user-bind" ? row.bind.raw_line
        : row.kind === "user-add" ? row.add.raw_line : null
    const deletePending = rawLineOf != null && kbDeleteConfirm != null && kbDeleteConfirm.raw_line === rawLineOf

    if (isThememod) {
        txt(ctx, x, y + 4, "THEME KEY", MONO, 10.5, g.accent, 0.9, 1)
        let cx = x + 76
        const parts = row.combo.split("+").map(s => s.trim()).filter(Boolean)
        for (let i = 0; i < parts.length; i++) {
            const chipW = drawKeyCap(ctx, cx, y - CAP_H / 2, parts[i], CAP_H, { glow: true, fs: 13 })
            const chipKey = `${keyPrefix}:chip:${i}`
            g.push({
                kind: "btn", hoverable: true, key: chipKey, bx0: cx, by0: y - CAP_H / 2, bx1: cx + chipW, by1: y + CAP_H / 2,
                on: () => startCapture("thememod", {}),
            })
            cx += chipW + 4
        }
        return
    }

    const label = row.kind === "user-bind" ? row.label : row.kind === "user-add" ? row.label : row.action.label
    const labelCol: any = deletePending ? [1, 0.4, 0.44] : (isRebound ? [1, 0.84, 0.12] : (isUser ? g.col : [0.78, 0.9, 1]))
    txt(ctx, x, y + 4, label, TITLE, 12.5, labelCol, 0.97, 1)
    const labelW = ctx.textExtents(label).width

    let cx = x + Math.min(w - 265, labelW + 28)
    const parts = row.combo.split("+").map(s => s.trim()).filter(Boolean)
    const chipCol = isRebound ? [1, 0.84, 0.12] : (isUser ? g.accent : [0.72, 0.88, 1])
    if (deletePending) {
        const red: any = [1, 0.4, 0.44]
        txt(ctx, cx, y + 3, "DELETE?", MONO, 9, red, 0.98, 1, 0)
        drawBtn(ctx, g.push, x + w - 84, y - 9, 36, 20, "YES", () => {
            const r = removeCustom(rawLineOf as number)
            kbStatus = r.ok ? { ok: true, msg: `// DELETED ${kbDeleteConfirm!.combo}` } : { ok: false, msg: "// DELETE FAILED" }
            kbDeleteConfirm = null
            ctrl.requestDraw()
        }, false, red, "", 9)
        drawBtn(ctx, g.push, x + w - 44, y - 9, 36, 20, "NO", () => {
            kbDeleteConfirm = null
            ctrl.requestDraw()
        }, false, g.col, "", 9)
        return
    }
    for (let i = 0; i < parts.length; i++) {
        const chipW = drawKeyCap(ctx, cx, y - CAP_H / 2, parts[i], CAP_H, { glow: isRebound, fs: 13 })
        const chipKey = `${keyPrefix}:chip:${i}`
        g.push({
            kind: "btn", hoverable: true, key: chipKey, bx0: cx, by0: y - CAP_H / 2, bx1: cx + chipW, by1: y + CAP_H / 2,
            on: () => {
                if (row.kind === "theme") startCapture("theme", { actionId: row.action.id })
                else if (row.kind === "user-bind") startCapture("user", { rawLine: row.bind.raw_line })
                else if (row.kind === "user-add") startCapture("newuser", { label: row.add.label })
            },
        })
        if (i < parts.length - 1) {
            txt(ctx, cx + chipW + 1, y + 1, "+", MONO, 9, chipCol, 0.6, 1, 0)
        }
        cx += chipW + 9
    }
    if (isRebound) {
        txt(ctx, cx + 6, y + 1, "REBOUND", MONO, 9, [1, 0.84, 0.12], 0.95, 1, 0)
    } else if (isUser) {
        txt(ctx, cx + 6, y + 1, "USER", MONO, 9, g.accent, 0.88, 1, 0)
    }
    if (isUser && rawLineOf != null) {
        const tsz = 13, tx = x + w - tsz - 16, ty = y - 8
        const delKey = `${keyPrefix}:del`
        const t = trashHoverStep(delKey, g.push.hoverKey === delKey)
        drawTrash(ctx, tx, ty, tsz, [1, 0.4, 0.44], t)
        g.push({
            kind: "btn", hoverable: true, key: delKey,
            bx0: tx - 6, by0: ty - 6, bx1: tx + tsz + 6, by1: ty + tsz + 6,
            on: () => {
                kbDeleteConfirm = { raw_line: rawLineOf as number, combo: row.combo, label }
                ctrl.requestDraw()
            },
        })
    }
}

const drawSubHeader = (ctx, g, x, y, w, label) => {
    ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.35); ctx.setLineWidth(0.7)
    ctx.newPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y); ctx.stroke()
    ctx.newPath(); ctx.moveTo(x + 80, y); ctx.lineTo(x + w, y); ctx.stroke()
    txt(ctx, x + 64, y + 3, label, MONO, 9.5, g.col, 0.75, 1, 0)
}

const drawCaptureForm = (ctx, g, x, y, w) => {
    let cy = y
    const title = kbCaptureKind === "thememod" ? "// EDIT THEME MOD" : kbCaptureKind === "newuser" ? "// ADD KEYBIND" : kbCaptureKind === "user" ? "// EDIT USER BIND" : "// REBIND THEME ACTION"
    sectionHeader(ctx, g, x, cy, title, w)
    cy += 22

    if (kbCaptureKind === "theme" && kbCaptureCtx.actionId) {
        txt(ctx, x, cy, `TARGET  ${kbCaptureCtx.actionId}`, MONO, 9.5, g.accent, 0.95, 1)
        cy += 16
    } else if (kbCaptureKind === "user" && kbCaptureCtx.rawLine != null) {
        txt(ctx, x, cy, `EDIT  user-bind @ line ${kbCaptureCtx.rawLine}`, MONO, 9.5, g.accent, 0.95, 1)
        cy += 16
    } else if (kbCaptureKind === "newuser") {
        if (kbAddStep === "prompt") {
            txt(ctx, x, cy, "// WHAT SHOULD THIS BIND DO?", MONO, 9, g.accent, 0.95, 1)
            cy += 18
            const bw = (w - 6) / 2
            drawBtn(ctx, g.push, x, cy, w, 32, "RUN COMMAND", () => {
                kbAddStep = "command"
                kbCommandText = ""
                ctrl.requestDraw()
            }, false, g.col, "", 10)
            cy += 40
            drawBtn(ctx, g.push, x, cy, w, 32, "LAUNCH APP", () => {
                kbAddStep = "app"
                openAppsMenuForKeybind()
            }, false, g.col, "", 10)
            cy += 40
            return
        }
        if (kbAddStep === "command") {
            txt(ctx, x, cy, "// TYPE A SHELL COMMAND", MONO, 9, g.accent, 0.95, 1)
            cy += 18
            const fieldH = 32
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.10)
            btnPath(ctx, x, cy, w, fieldH); ctx.fill()
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.7)
            ctx.setLineWidth(0.9)
            btnPath(ctx, x, cy, w, fieldH); ctx.stroke()
            const placeholder = kbCommandText || "// e.g. alacritty -e htop"
            txt(ctx, x + 12, cy + fieldH / 2 + 4, placeholder, MONO, 10, g.col, kbCommandText ? 0.95 : 0.55, 1, 0)
            cy += fieldH + 6
            const bw = (w - 6) / 2
            drawBtn(ctx, g.push, x, cy, bw, 26, "USE COMMAND", () => {
                kbCaptureKind = "newuser"
                kbCaptureCtx = { label: kbCommandText || "exec_cmd" }
                kbCaptureLabel = kbCommandText || "exec_cmd"
                kbAddStep = "capture"
                ctrl.requestDraw()
            }, false, [0.42, 1, 0.6], "", 9)
            drawBtn(ctx, g.push, x + bw + 6, cy, bw, 26, "BACK", () => {
                kbAddStep = "prompt"
                ctrl.requestDraw()
            }, false, g.col, "", 9)
            cy += 34
            return
        }
        if (kbAddStep === "app") {
            txt(ctx, x, cy, "// PICK AN APP FROM THE WHEEL", MONO, 9, g.accent, 0.95, 1)
            cy += 18
            const fieldH = 32
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.10)
            btnPath(ctx, x, cy, w, fieldH); ctx.fill()
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.7)
            ctx.setLineWidth(0.9)
            btnPath(ctx, x, cy, w, fieldH); ctx.stroke()
            txt(ctx, x + 12, cy + fieldH / 2 + 4, "// apps wheel is open — scroll/click to pick", MONO, 10, g.col, 0.6, 1, 0)
            cy += fieldH + 6
            const bw = (w - 6) / 2
            drawBtn(ctx, g.push, x, cy, bw, 26, "BACK", () => {
                kbAddStep = "prompt"
                ctrl.requestDraw()
            }, false, g.col, "", 9)
            cy += 34
            return
        }
    }

    const isListening = kbListening && !kbCaptured
    const displayCombo = kbCaptured ? kbCaptured.combo : (kbHeld.mods.length > 0 || kbHeld.key != null ? liveHeldAsCombo() : null)
    const liveParts = displayCombo ? displayCombo.split("+").map(s => s.trim()).filter(Boolean) : []

    const boxH = 56
    const bx0 = x
    const by0 = cy
    const bx1 = x + w
    const by1 = cy + boxH
    const boxGlow = isListening
    ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], isListening ? 0.18 : 0.08)
    btnPath(ctx, bx0, by0, w, boxH); ctx.fill()
    ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], boxGlow ? 0.95 : 0.6)
    ctx.setLineWidth(boxGlow ? 1.4 : 0.9)
    btnPath(ctx, bx0, by0, w, boxH); ctx.stroke()
    if (isListening) {
        ctx.setOperator(12); ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.5)
        btnPath(ctx, bx0, by0, w, boxH); ctx.setLineWidth(2.6); ctx.stroke(); ctx.setOperator(2)
    }

    if (displayCombo && liveParts.length > 0) {
        let cx = bx0 + 14
        const cyChip = by0 + (boxH - CAP_H) / 2
        for (let i = 0; i < liveParts.length; i++) {
            const cw = drawKeyCap(ctx, cx, cyChip, liveParts[i], CAP_H, { glow: isListening || !!kbCaptured })
            cx += cw + 8
        }
    } else {
        const hint = kbCaptureKind === "thememod"
            ? (isListening ? "// hold modifiers, then release" : "// click here, then hold modifiers")
            : (isListening ? "// listening for keys …" : "// click here, then press a key combo")
        ctx.selectFontFace(MONO, 0, 0); ctx.setFontSize(10)
        const tw = ctx.textExtents(hint).width
        txt(ctx, bx0 + (w - tw) / 2, by0 + boxH / 2 + 3, hint, MONO, 10, g.col, 0.7, 1, 0)
    }

    g.push({
        kind: "btn", hoverable: true, key: `kb:listen:${x}:${cy}`, bx0, by0, bx1, by1,
        on: () => {
            grabKeys()
            kbCaptured = null
            kbHeld = { mods: [], modsMask: 0, key: null }
            kbListening = true
            ctrl.requestDraw()
        },
    })
    cy += boxH + 12

    if (kbConflict) {
        const label = kbConflict.kind === "theme" ? `THEME DEFAULT: ${kbConflict.label}` : `ALREADY BOUND: ${kbConflict.label}`
        const col: any = kbConflict.kind === "theme" ? [1, 0.84, 0.12] : [1, 0.4, 0.44]
        txt(ctx, x, cy, label, MONO, 9, col, 0.98, 1)
        cy += 14
        const bw = (w - 6) / 2
        drawBtn(ctx, g.push, x, cy, bw, 26, "REPLACE", () => { applyConflictReplace() }, false, [1, 0.84, 0.12])
        drawBtn(ctx, g.push, x + bw + 6, cy, bw, 26, "CANCEL", () => { kbConflict = null; ctrl.requestDraw() }, false, g.col)
        return
    }

    const bw = (w - 6) / 2
    const canSave = !!kbCaptured || (kbCaptureKind === "thememod" && !!displayCombo)
    drawBtn(ctx, g.push, x, cy, bw, 28, "SAVE", () => { commitCapture() }, false, [0.42, 1, 0.6], "", 10)
    void canSave
    drawBtn(ctx, g.push, x + bw + 6, cy, bw, 28, "CANCEL", () => { cancelCapture() }, false, g.col)
}

const drawKeybinds = (ctx, g, x, y, w) => {
    const state = readUserLua()
    const themeMod = state.themeMod ?? themeModDefault()
    const userRebinds: Rebind[] = state.rebinds

    if (kbCaptureKind) {
        drawCaptureForm(ctx, g, x, y, w)
        return
    }

    let cy = y
    const addBtnW = 130
    const reloadBtnW = 150
    const gap = 8
    const totalW = addBtnW + gap + reloadBtnW
    const startX = x + (w - totalW) / 2
    drawBtn(ctx, g.push, startX, cy, addBtnW, 26, "+ ADD KEYBIND", () => {
        startCapture("newuser", { label: "" })
    }, false, g.col, "", 10)
    drawBtn(ctx, g.push, startX + addBtnW + gap, cy, reloadBtnW, 26, "RELOAD HYPRLAND", () => {
        reloadHyprland()
        kbStatus = { ok: true, msg: "// HYPRLAND RELOADED" }
        ctrl.requestDraw()
    }, false, [0.42, 1, 0.6], "", 10)
    cy += 34

    if (kbStatus) {
        const col = kbStatus.ok ? [0.42, 1, 0.6] : [1, 0.4, 0.44]
        txt(ctx, x, cy, kbStatus.msg, MONO, 9, col, 0.95, 1)
        cy += 14
    }

    const rows = buildRows(themeMod, userRebinds, state.customBinds, state.adds)
    const visTop = cy
    const visBottom = g.Y + g.h - 20
    const visHeight = visBottom - visTop

    const layout: { y: number; h: number; kind: "section" | "sub"; label: string; rowIdx: number }[] = []
    let yAcc = 0
    let lastSection: string | null = null
    let lastSubgroup: string | null = null
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (r.kind === "theme") {
            if (lastSection !== "theme") {
                layout.push({ y: yAcc, h: 32, kind: "section", label: "// THEME KEYBINDS", rowIdx: -1 })
                yAcc += 32
                lastSection = "theme"
                lastSubgroup = null
            }
            if (lastSubgroup !== r.subgroup) {
                layout.push({ y: yAcc, h: 22, kind: "sub", label: r.subgroup, rowIdx: -1 })
                yAcc += 22
                lastSubgroup = r.subgroup
            }
        } else if (r.kind === "user-bind" || r.kind === "user-add") {
            if (lastSection !== "user") {
                layout.push({ y: yAcc, h: 32, kind: "section", label: "// USER KEYBINDS", rowIdx: -1 })
                yAcc += 32
                lastSection = "user"
                lastSubgroup = null
            }
        } else if (r.kind === "thememod") {
            lastSection = "thememod"
            lastSubgroup = null
            yAcc += THEMEMOD_TOP
        }
        layout.push({ y: yAcc, h: ROW_H, kind: "section", label: "", rowIdx: i })
        yAcc += ROW_H
    }
    const totalH = yAcc + SCROLL_PAD
    const maxScroll = Math.max(0, totalH - visHeight)
    kbMaxScroll = maxScroll
    if (kbScroll > maxScroll) kbScroll = maxScroll
    if (kbScroll < 0) kbScroll = 0

    ctx.save()
    ctx.rectangle(x - 4, visTop, w + 8, visHeight)
    ctx.clip()

    for (const item of layout) {
        const drawY = visTop + item.y - kbScroll
        if (item.kind === "section" && item.label) {
            sectionHeader(ctx, g, x, drawY + 6, item.label, w)
            continue
        }
        if (item.kind === "sub") {
            drawSubHeader(ctx, g, x, drawY + 2, w, item.label)
            continue
        }
        const i = item.rowIdx
        const r = rows[i]
        if (drawY + ROW_H < visTop || drawY > visBottom) continue
        drawChipRow(ctx, g, x, drawY + (ROW_H - CAP_H) / 2 + 4, w, r, `kbrow:${i}`)
    }
    ctx.restore()

    if (maxScroll > 0) {
        const fillH = visHeight * (kbScroll / maxScroll)
        const barH = Math.max(20, visHeight - fillH)
        const barY = visTop + fillH
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.85); ctx.setLineWidth(3)
        ctx.newPath(); ctx.moveTo(x + w + 4, barY); ctx.lineTo(x + w + 4, barY + barH); ctx.stroke()
    } else {
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
    }
}

const drawWip = (ctx, g, x, y, w) => {
    const cx = x + w / 2
    const t1 = "WORK IN PROGRESS."
    ctx.selectFontFace(TITLE, 0, 1); ctx.setFontSize(16)
    txt(ctx, cx - ctx.textExtents(t1).width / 2, y + 72, t1, TITLE, 16, g.accent, 0.95, 1, 0.3)
    const t2 = "COMING SOON :)"
    ctx.selectFontFace(MONO, 0, 0); ctx.setFontSize(11)
    txt(ctx, cx - ctx.textExtents(t2).width / 2, y + 98, t2, MONO, 11, g.col, 0.6)
}
