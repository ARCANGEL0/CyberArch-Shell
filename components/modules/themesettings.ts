import { execAsync, timeout, Variable } from "astal"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import GdkPixbuf from "gi://GdkPixbuf"
import { Window, DrawingArea, EventBox, Keymode, Layer, Anchor } from "./widget.ts"
import { PALETTES, getPaletteName, applyPalette, saveUserColors, setUserColor, getUserColor, rgbToHex, hasAlpha, getUserAlpha, setUserAlpha, USER, onColorChange } from "./colors.ts"
import { closeAllModals } from "./cmodal.ts"
import { TITLE, MONO, CYAN, ACC, HEADER, txt, drawGlass, Cairo, ch } from "./glass.ts"
import { ICONF } from "./fonts.ts"
import { drawBtn, drawToggle, drawSlider, sectionHeader, drawKeyCap, btnPath } from "./cmodal.ts"
import { cfgBool, cfgStr, setCfg, toggleCfg, resetCfg, adoptSound, clearSound, GAUGE_OPTS, METRIC_LABEL } from "./config.ts"
import {
    wmBool, wmNum, wmStr, setWm, toggleWm, resetWm, wmCornersIs,
    CORNER_OPTS, CORNER_LABEL, OPACITY_MODES, OPACITY_MODE_LABEL, type WmVal,
} from "./wmconfig.ts"
import { USER_DIR, CYBER_DIR, WALLPAPERS_PATH, WALLPAPER_LUA, SCREEN_WIDTH, SCREEN_HEIGHT } from "../../env.ts"
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
export let selPalette = "NETWATCH"

export const readTune = () => {
    selPalette = getPaletteName()
    wallPickerOpen = false
    wallPickerSel = null
    wallPickerEntries = []
    wallOpen = null
    wallScroll = 0
}

export const applyColors = (name: string) => { closeAllModals(); applyPalette(name); saveUserColors(); selPalette = name; sh(`"${CYBER_DIR}/scripts/theme-wallpaper" "${name}"`) }

export const TABS: [string, string][] = [
    ["CONFIGURATION", "anim"], ["COLORS", "colors"], ["KEYBINDS", "keybinds"],
    ["WINDOW MANAGEMENT", "wm"], ["WALLPAPER", "wall"],
]
const TAB_BADGE: Record<string, string> = { colors: "PAL", wm: "TUNE", anim: "CFG" }
let tab = "anim"
let ctrl: any = null

const wheelEntries = () =>
    TABS.map(([label, id]) => ({ label, badge: TAB_BADGE[id] ?? "", glyph: null, data: id }))

const drawTabBar = (ctx, g, x, y, w) => {
    const totalTabs = TABS.length
    const tabSpacing = 150
    const totalWidth = totalTabs * tabSpacing
    const startX = (w - totalWidth) / 2 + x
    const tabY = y + 20
    const currentIdx = TABS.findIndex(t => t[1] === tab)

    // Draw navigation indicators
    txt(ctx, startX - 60, tabY, "[1]", MONO, 13, g.accent, 0.5)
    txt(ctx, startX - 30, tabY, "<", MONO, 14.5, g.accent, 0.6)

    TABS.forEach(([label, id], i) => {
        const tx = startX + i * tabSpacing
        const isActive = tab === id

        // Draw tab label
        const col = isActive ? (USER.cyan as any) : g.accent
        const alpha = isActive ? 1 : 0.65
        txt(ctx, tx, tabY, label, TITLE, 13, col, alpha)

        // Draw underline for active tab
        if (isActive) {
            ctx.setSourceRGBA(USER.cyan[0], USER.cyan[1], USER.cyan[2], 0.9)
            ctx.setLineWidth(2)
            ctx.newPath()
            const labelWidth = ctx.textExtents(label).width + 20
            ctx.moveTo(tx - 10, tabY + 11)
            ctx.lineTo(tx + labelWidth, tabY + 11)
            ctx.stroke()
        }

        // Register click area
        const labelWidth = ctx.textExtents(label).width + 20
        g.push({
            kind: "tab", key: `tab_${id}`, hoverable: true,
            bx0: tx - 10, by0: tabY - 20, bx1: Math.min(tx + labelWidth, startX + (i + 1) * tabSpacing - 8), by1: tabY + 16,
            on: () => {
                if (tab !== id) {
                    tab = id
                    kbScroll = 0
                    cfgOpen = null
                    if (tab !== "wall") { wallOpen = null; wallScroll = 0 }
                    area?.queue_draw()
                }
            }
        })
    })

    txt(ctx, startX + totalWidth + 30, tabY, ">", MONO, 14.5, g.accent, 0.6)
    txt(ctx, startX + totalWidth + 60, tabY, `[${totalTabs}]`, MONO, 13, g.accent, 0.5)

    // Draw separator line below tabs
    ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.3)
    ctx.setLineWidth(1)
    ctx.newPath()
    ctx.moveTo(x + 40, tabY + 26)
    ctx.lineTo(x + w - 40, tabY + 26)
    ctx.stroke()
}

const visible = Variable(false)
export let area: any = null
let mouseX = 0
let mouseY = 0
let hoverKey = ""
let clickTargets: any[] = []

const pushHandler = (item: any) => {
    if (item.hoverable && item.bx0 !== undefined) {
        clickTargets.push(item)
    }
}

export const ThemesWindow = () => {
    readTune()

    const handleMotion = (self: any, event: Gdk.EventMotion) => {
        mouseX = event.x
        mouseY = event.y
        let newHover = ""
        for (const t of clickTargets) {
            if (mouseX >= t.bx0 && mouseX <= t.bx1 && mouseY >= t.by0 && mouseY <= t.by1) {
                newHover = t.key
                break
            }
        }
        if (newHover !== hoverKey) {
            hoverKey = newHover
            area?.queue_draw()
        }
        return false
    }

    const handleClick = (self: any, event: Gdk.EventButton) => {
        for (const t of clickTargets) {
            if (mouseX >= t.bx0 && mouseX <= t.bx1 && mouseY >= t.by0 && mouseY <= t.by1) {
                if (t.on) t.on()
                break
            }
        }
        return false
    }

    const handleKey = (self: any, event: Gdk.EventKey) => {
        const k = event.keyval

        if (k === Gdk.KEY_Escape) {
            if (tab === "wall" && wallOpen) {
                wallOpen = null
                wallScroll = 0
                area?.queue_draw()
                return true
            }
            if (wmColorPick) {
                closeWmPicker()
                return true
            }
            if (kbCaptureKind || kbDeleteConfirm) {
                if (kbDeleteConfirm) kbDeleteConfirm = null
                else if (kbCaptureKind === "newuser" && (kbAddStep === "command" || kbAddStep === "app")) kbAddStep = "prompt"
                else cancelCapture()
                area?.queue_draw()
                return true
            }
            visible.set(false)
            releaseKeys()
            return true
        }

        if (wmAppText !== "" || (tab === "wm" && wmAppEditing)) {
            if (k === Gdk.KEY_Escape) { wmAppText = ""; wmAppEditing = false; area?.queue_draw() }
            else if (k === Gdk.KEY_Return) { commitWmApps() }
            else if (k === Gdk.KEY_BackSpace) { wmAppText = wmAppText.slice(0, -1); area?.queue_draw() }
            else {
                const u = Gdk.keyval_to_unicode(k)
                if (u >= 32 && u < 0x10000) { wmAppText += String.fromCharCode(u); area?.queue_draw() }
            }
            return true
        }

        if (k === Gdk.KEY_Left) {
            const idx = TABS.findIndex(t => t[1] === tab)
            const next = idx <= 0 ? TABS.length - 1 : idx - 1
            tab = TABS[next][1]
            kbScroll = 0
            cfgOpen = null
            if (tab !== "wall") { wallOpen = null; wallScroll = 0 }
            area?.queue_draw()
            return true
        }

        if (k === Gdk.KEY_Right) {
            const idx = TABS.findIndex(t => t[1] === tab)
            const next = idx >= TABS.length - 1 ? 0 : idx + 1
            tab = TABS[next][1]
            kbScroll = 0
            cfgOpen = null
            if (tab !== "wall") { wallOpen = null; wallScroll = 0 }
            area?.queue_draw()
            return true
        }

        return false
    }

    const draw = (self: any, cr: any) => {
        const w = SCREEN_WIDTH
        const h = SCREEN_HEIGHT

        clickTargets = []
        const g = {
            accent: USER.sysveil as any,
            col: USER.sysveil as any,
            push: pushHandler,
            hoverKey,
            X: 0,
            Y: 0,
            w,
            h
        }

        cr.setSourceRGBA(0, 0, 0, 0.95)
        cr.rectangle(0, 0, w, h)
        cr.fill()

        const tabBarH = 78
        const contentY = tabBarH + 20
        const contentH = h - contentY - 20

        drawTabBar(cr, g, 40, 10, w - 80)

        const x = 60
        const cw = w - 120

        if (tab === "colors") drawColors(cr, g, x, contentY, cw)
        else if (tab === "keybinds") drawKeybinds(cr, g, x, contentY, cw)
        else if (tab === "anim") drawConfig(cr, g, x, contentY, cw)
        else if (tab === "wm") drawWm(cr, g, x, contentY, cw)
        else if (tab === "wall" && !wallOpen) drawWallRing(cr, g, x, contentY, cw)
        else drawWallBrowse(cr, g, x, contentY, cw)
    }

    area = DrawingArea({
        widthRequest: SCREEN_WIDTH,
        heightRequest: SCREEN_HEIGHT,
        onDraw: draw
    })

    return Window({
        name: "themesettings",
        layer: Layer.OVERLAY,
        anchor: Anchor.TOP | Anchor.BOTTOM | Anchor.LEFT | Anchor.RIGHT,
        keymode: Keymode.ON_DEMAND,
        visible: visible(),
        setup: (self) => {
            visible.subscribe(() => {
                self.visible = visible.get()
                if (visible.get()) {
                    readTune()
                    releaseKeys()
                    tab = TABS[0][1]
                    kbScroll = 0
                    cfgOpen = null
                    wallOpen = null
                    wallScroll = 0
                    area?.queue_draw()
                }
            })
        },
        onKeyPressEvent: handleKey,
        child: EventBox({
            onButtonPressEvent: handleClick,
            onMotionNotifyEvent: handleMotion,
            child: area
        })
    })
}

export const toggleThemeSettings = () => {
    visible.set(!visible.get())
}

export const ThemesCtrl = () => {
    return {
        open: () => visible.set(true),
        close: () => visible.set(false),
        requestDraw: () => area?.queue_draw()
    }
}

const oldCtrl = ThemesCtrl()
ctrl = oldCtrl

export const openThemeSettings = () => oldCtrl.open()
export const closeThemeSettings = () => oldCtrl.close()

type ColRow = [string, string, boolean]
const SECTIONS: [string, ColRow[]][] = [
    ["// GENERAL", [
        ["cyan", "ACCENT COLOR", false],
        ["modalbg", "MODALS BACKGROUND", true],
        ["glassacc", "MODALS FOREGROUND", false],
        ["modalhov", "MODAL HOVER", false],
        ["wheelbg", "WHEEL BACKGROUND", true],
        ["wheelfg", "WHEEL FOREGROUND", false],
    ]],
    ["// GAUGE BARS", [
        ["badge", "BADGE", false],
        ["xpbar", "EXPERIENCE BAR", false],
        ["cpu", "HEALTH BAR", false],
        ["ram", "RAM BAR", false],
        ["stamina", "STAMINA BAR", false],
    ]],
    ["// DOCK", [
        ["dockv", "VERTICAL DOCK", false],
        ["dockvh", "VERTICAL HOVER", false],
        ["dockh", "HORIZONTAL DOCK", false],
        ["dockhh", "HORIZONTAL HOVER", false],
    ]],
    ["// LAUNCHER", [
        ["launchico", "LAUNCHER ICON", false],
        ["launchlbl", "LAUNCHER LABEL", false],
    ]],
    ["// MINIMAP PANE", [
        ["mapclock", "CLOCK", false],
        ["mapcity", "CITY", false],
        ["maptile", "MINIMAP TILE TINT", true],
        ["mapaccent", "TEXT ACCENT", false],
        ["mapwx", "WEATHER", false],
    ]],
    ["// NETWORK", [
        ["netinfo", "NETWORK FOREGROUND", false],
        ["netchip", "NETWORK CHIP", false],
        ["netdown", "NET DOWNLOAD", false],
        ["netup", "NET UPLOAD", false],
    ]],
    ["// MARKET", [
        ["mktacc", "MARKET ACCENT", false],
        ["mkthov", "MARKET HOVER", false],
    ]],
    ["// POPUPS", [
        ["aurbg", "AUR FRAME BACKGROUND", true],
        ["aurfg", "AUR FRAME FOREGROUND", false],
        ["auricon", "AUR ICON", false],
        ["aurlbl", "AUR LABELS", false],
        ["notifbadge", "NOTIFICATION BADGE", false],
        ["notifphone", "NOTIFICATION PHONE", false],
        ["notifmail", "NOTIFICATION MAIL", false],
        ["notifheads", "NOTIFICATION HEADSUP", false],
        ["notiftitle", "NOTIFICATION TITLE", false],
        ["notiffg", "NOTIFICATION FOREGROUND", false],
        ["notifbg", "NOTIFICATION BACKGROUND", true],
        ["notiflbl", "NOTIFICATION LABELS", false],
    ]],
    ["// RADIOPORT", [
        ["radiotitle", "HEADER TITLE", false],
        ["radiohdrbg", "HEADER BACKGROUND", true],
        ["radioacc", "RADIOPORT ACCENT", false],
        ["radiovol", "VOLUME FOREGROUND", false],
        ["radiotrkfg", "TRACKS FOREGROUND", false],
        ["radiotrkbg", "TRACKS BACKGROUND", true],
        ["radioctl", "RADIOPORT CONTROLS", false],
    ]],
]

const CROW_H = 32
const CSEC_H = 40

export const drawColors = (ctx, g, x, y, w) => {
    sectionHeader(ctx, g, x, y, "// PALETTE", w, 12)
    const names = Object.keys(PALETTES), cols = 4, bw = (w - (cols - 1) * 8) / cols, bh = 32, top = y + 16
    names.forEach((name, i) => {
        const bx = x + (i % cols) * (bw + 8), by = top + Math.floor(i / cols) * (bh + 8)
        drawBtn(ctx, g.push, bx, by, bw, bh, name === "NETWATCH" ? "★" + name : name, () => applyColors(name), selPalette === name, selPalette === name ? (USER.cyan as any) : g.col, "", 13)
    })
    const gridH = Math.ceil(names.length / cols) * (bh + 8)
    const footY = g.Y + g.h - 48
    const visTop = top + gridH + 10
    const visBottom = footY - 10
    const visHeight = visBottom - visTop

    const layout: { y: number; kind: "sec" | "row"; label: string; key: string; alp: boolean }[] = []
    let yAcc = 0
    for (const [title, rows] of SECTIONS) {
        layout.push({ y: yAcc, kind: "sec", label: title, key: "", alp: false })
        yAcc += CSEC_H
        for (const [key, label, alp] of rows) {
            layout.push({ y: yAcc, kind: "row", label, key, alp })
            yAcc += CROW_H
        }
        yAcc += 8
    }
    const maxScroll = Math.max(0, yAcc + 12 - visHeight)
    kbMaxScroll = maxScroll
    if (kbScroll > maxScroll) kbScroll = maxScroll
    if (kbScroll < 0) kbScroll = 0

    ctx.save()
    ctx.rectangle(x - 4, visTop, w + 8, visHeight)
    ctx.clip()
    for (const it of layout) {
        const ry = visTop + it.y - kbScroll
        if (it.kind === "sec") {
            if (ry + CSEC_H >= visTop && ry <= visBottom) sectionHeader(ctx, g, x, ry + 10, it.label, w, 12)
            continue
        }
        if (ry + CROW_H < visTop || ry > visBottom) continue
        const hit = ry >= visTop - 1 && ry + CROW_H <= visBottom + 1
        drawColorRow(ctx, g, x, ry, w, it.key, it.label, it.alp, hit)
    }
    ctx.restore()

    if (maxScroll > 0) {
        const fillH = visHeight * (kbScroll / maxScroll)
        const barH = Math.max(20, visHeight - fillH)
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.85); ctx.setLineWidth(3)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop + fillH); ctx.lineTo(x + w + 4, visTop + fillH + barH); ctx.stroke()
    }
    drawBtn(ctx, g.push, x, footY, w, 38, "RESET", () => { applyPalette("NETWATCH"); saveUserColors(); readTune(); selPalette = "NETWATCH"; kbScroll = 0; ctrl.requestDraw() }, false, [1, 0.4, 0.44], "", 13)
}

const noPush = (_r: any) => {}
const drawColorRow = (ctx, g, x, ry, w, key: string, label: string, alp: boolean, hit = true) => {
    const push = hit ? g.push : noPush
    const rgb = getUserColor(key)
    ctx.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 0.95)
    ctx.rectangle(x, ry + 4, 19, 19); ctx.fill()
    ctx.setSourceRGBA(1, 1, 1, 0.28); ctx.setLineWidth(1); ctx.rectangle(x + 0.5, ry + 4.5, 18, 18); ctx.stroke()
    txt(ctx, x + 28, ry + 21, label, TITLE, 12, g.accent, 0.9, 1)
    txt(ctx, x + 250, ry + 21, rgbToHex(rgb), MONO, 10.5, g.col, 0.72)
    drawStrip(ctx, push, "hue", key, x + 310, ry + 4, 130, 24)
    drawStrip(ctx, push, "val", key, x + 450, ry + 4, 80, 24)
    if (alp && hasAlpha(key)) {
        drawStrip(ctx, push, "alp", key, x + 538, ry + 4, 64, 24)
        txt(ctx, x + 612, ry + 21, getUserAlpha(key).toFixed(2), MONO, 10, g.col, 0.72)
    }
}

const hueRgb = (t: number): [number, number, number] => {
    const h = ((t % 1 + 1) % 1) * 6
    const x = 1 - Math.abs(h % 2 - 1)
    const [r, gc, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x]
    return [Math.round(r * 255), Math.round(gc * 255), Math.round(b * 255)]
}
const rgbVal = (c: [number, number, number]) => Math.max(c[0], c[1], c[2]) / 255
const rgbHue = (c: [number, number, number]): number => {
    const r = c[0] / 255, gc = c[1] / 255, b = c[2] / 255
    const mx = Math.max(r, gc, b), mn = Math.min(r, gc, b), d = mx - mn
    if (d < 0.0005) return 0
    const h = mx === r ? ((gc - b) / d + 6) % 6 : mx === gc ? (b - r) / d + 2 : (r - gc) / d + 4
    return h / 6
}
const valBase: Record<string, [number, number, number]> = {}
const baseOf = (key: string, c: [number, number, number]): [number, number, number] => {
    const mx = Math.max(c[0], c[1], c[2])
    if (mx >= 1) { valBase[key] = [c[0] * 255 / mx, c[1] * 255 / mx, c[2] * 255 / mx]; return valBase[key] }
    return valBase[key] ?? [255, 255, 255]
}
const commit = (key: string, c: [number, number, number]) => {
    setUserColor(key, c)
    saveUserColors()
    ctrl.requestDraw()
}
const pickHue = (key: string, t: number) => {
    const v = Math.max(0.06, rgbVal(getUserColor(key)))
    const h = hueRgb(t)
    valBase[key] = h
    commit(key, [h[0] * v, h[1] * v, h[2] * v])
}
const pickVal = (key: string, t: number) => {
    const n = baseOf(key, getUserColor(key))
    const v = Math.max(0, Math.min(1, t))
    commit(key, [n[0] * v, n[1] * v, n[2] * v])
}
const pickAlpha = (key: string, t: number) => {
    setUserAlpha(key, Math.max(0, Math.min(1, t)))
    saveUserColors()
    ctrl.requestDraw()
}
const drawStrip = (ctx, push, kind: "hue" | "val" | "alp", key: string, x, y, w, h) => {
    const cur = getUserColor(key)
    const grad = new Cairo.LinearGradient(x, 0, x + w, 0)
    let mark = 0
    if (kind === "hue") {
        for (let i = 0; i <= 6; i++) { const [r, gc, b] = hueRgb(i / 6); grad.addColorStopRGBA(i / 6, r / 255, gc / 255, b / 255, 1) }
        mark = rgbHue(cur)
    } else if (kind === "val") {
        const n = baseOf(key, cur)
        grad.addColorStopRGBA(0, 0, 0, 0, 1)
        grad.addColorStopRGBA(1, n[0] / 255, n[1] / 255, n[2] / 255, 1)
        mark = rgbVal(cur)
    } else {
        grad.addColorStopRGBA(0, cur[0] / 255, cur[1] / 255, cur[2] / 255, 0)
        grad.addColorStopRGBA(1, cur[0] / 255, cur[1] / 255, cur[2] / 255, 1)
        mark = getUserAlpha(key)
    }
    ctx.save(); ctx.rectangle(x, y, w, h); ctx.clip()
    if (kind === "alp") {
        const sq = 4
        for (let i = 0; i * sq < w; i++) for (let j = 0; j * sq < h; j++) {
            ctx.setSourceRGBA(0.55, 0.6, 0.65, ((i + j) % 2) ? 0.34 : 0.1)
            ctx.rectangle(x + i * sq, y + j * sq, sq, sq); ctx.fill()
        }
    }
    ctx.setSource(grad); ctx.rectangle(x, y, w, h); ctx.fill()
    ctx.restore()
    ctx.setSourceRGBA(1, 1, 1, 0.4); ctx.setLineWidth(1); ctx.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); ctx.stroke()
    const mx = x + Math.max(1.2, Math.min(w - 1.2, mark * w))
    ctx.setSourceRGBA(0, 0, 0, 0.75); ctx.setLineWidth(2.6); ctx.newPath(); ctx.moveTo(mx, y + 1); ctx.lineTo(mx, y + h - 1); ctx.stroke()
    ctx.setSourceRGBA(1, 1, 1, 0.95); ctx.setLineWidth(1.1); ctx.newPath(); ctx.moveTo(mx, y + 1); ctx.lineTo(mx, y + h - 1); ctx.stroke()
    push({ kind: "sld", bx0: x, by0: y, bx1: x + w, by1: y + h, u0: x, v0: y, u1: x + w, v1: y, on: (t: number) => kind === "hue" ? pickHue(key, t) : kind === "val" ? pickVal(key, t) : pickAlpha(key, t) })
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
export let kbScroll = 0
export let kbMaxScroll = 0

export const setKbScroll = (v: number) => { kbScroll = v }
export const setKbMaxScroll = (v: number) => { kbMaxScroll = v }
let kbAddStep: "prompt" | "command" | "app" | "capture" | null = null
let wmOpen: string | null = null
let wmExpand: Record<string, boolean> = {}
let wmColorPick: { key: string; h: number; s: number; v: number } | null = null
let wmAppEditing = false
let wmAppText = ""
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
            const chipW = drawKeyCap(ctx, cx, y - CAP_H / 2, parts[i], CAP_H, { glow: true, fs: 13, col: USER.cyan as any })
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
    const labelCol: any = deletePending ? [1, 0.4, 0.44] : (isRebound ? [1, 0.84, 0.12] : g.col)
    txt(ctx, x, y + 4, label, TITLE, 12.5, labelCol, 0.97, 1)
    const labelW = ctx.textExtents(label).width

    let cx = x + Math.min(w - 265, labelW + 28)
    const parts = row.combo.split("+").map(s => s.trim()).filter(Boolean)
    const chipCol = isRebound ? [1, 0.84, 0.12] : (USER.cyan as any)
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
        const chipW = drawKeyCap(ctx, cx, y - CAP_H / 2, parts[i], CAP_H, { glow: isRebound, fs: 13, col: USER.cyan as any })
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
            const cw = drawKeyCap(ctx, cx, cyChip, liveParts[i], CAP_H, { glow: isListening || !!kbCaptured, col: USER.cyan as any })
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

export const drawKeybinds = (ctx, g, x, y, w) => {
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

const WALL_THEMES: [string, string][] = [
    ["NETWATCH", "netwatch"], ["SYNTHWAVE", "synthwave"], ["JOHNNY", "johnny"], ["KITTY", "kitty"],
    ["BLADE", "blade_runner"], ["BLOODMOON", "bloodmoon"], ["GHOST", "ghost"], ["ARCTIC", "arctic"],
    ["OTHERS", "others"],
]

const WALL_EXTS = ["mp4", "webm", "mkv", "mov", "png", "jpg", "jpeg", "webp", "gif"]
const isVideoExt = (e: string) => ["mp4", "webm", "mkv", "mov"].includes(e)
export let wallOpen: string | null = null
let wallFiles: { name: string; path: string; ext: string }[] = []
let wallFilesLoading = false
export let wallScroll = 0
let wallMaxScroll = 0
let wallUploading = false

export let wallPickerOpen = false
let wallPickerDir = ""
let wallPickerSel: { name: string; path: string; ext: string } | null = null
let wallPickerEntries: { name: string; path: string; dir: boolean; ext: string }[] = []
let wallPickerLoading = false
export let wallPickerScroll = 0
let wallPickerMaxScroll = 0
export const setWallPickerScroll = (v: number) => { wallPickerScroll = v }
let wallPathEditing = false
let wallPathText = ""

const THUMB_W = 160, THUMB_H = 90, THUMB_GAP = 10
const thumbCache: Record<string, GdkPixbuf.Pixbuf | null> = {}

const strHash = (s: string): string => {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
    return h.toString(36)
}

const readCurrentWallpaper = (): string => {
    try {
        const [ok, bytes] = GLib.file_get_contents(WALLPAPER_LUA)
        if (!ok) return ""
        const m = String(new TextDecoder().decode(bytes)).match(/wallpaper\s*=\s*"([^"]*)"/)
        return m ? m[1] : ""
    } catch { return "" }
}

const loadWallFiles = (folder: string) => {
    wallFiles = []
    wallScroll = 0
    wallFilesLoading = true
    sh(`find "${WALLPAPERS_PATH}/${folder}" -maxdepth 1 -type f 2>/dev/null | sort`).then((o) => {
        wallFilesLoading = false
        const out = String(o || "").trim()
        if (!out) { ctrl?.requestDraw(); return }
        wallFiles = out.split("\n").map((p) => p.trim()).filter(Boolean).map((p) => {
            const name = p.slice(p.lastIndexOf("/") + 1)
            const ext = (name.slice(name.lastIndexOf(".") + 1) || "").toLowerCase()
            return { name, path: p, ext }
        }).filter((f) => WALL_EXTS.includes(f.ext))
        ctrl?.requestDraw()
    })
}

const openWallTheme = (folder: string) => {
    wallOpen = folder
    loadWallFiles(folder)
    ctrl.requestDraw()
}

const getThumb = (path: string): GdkPixbuf.Pixbuf | null => {
    if (path in thumbCache) return thumbCache[path]
    thumbCache[path] = null
    const cacheDir = `${GLib.get_user_cache_dir()}/cyberpunk/thumbs`
    GLib.mkdir_with_parents(cacheDir, 0o755)
    const key = `${strHash(path)}.png`
    const cached = `${cacheDir}/${key}`
    const deliver = (p: string) => {
        try {
            const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(p, THUMB_W * 2, THUMB_H * 2, true)
            thumbCache[path] = pb
            ctrl?.requestDraw()
        } catch { }
    }
    let have = false
    try { have = GLib.file_test(cached, GLib.FileTest.EXISTS) } catch { }
    if (have) { deliver(cached); return null }
    if (isVideoExt(path.slice(path.lastIndexOf(".") + 1).toLowerCase())) {
        sh(`mkdir -p "${cacheDir}" && ffmpeg -y -ss 1 -i "${path}" -vframes 1 -vf "scale=${THUMB_W * 2}:-2" "${cached}" 2>/dev/null`).then(() => deliver(cached))
    } else {
        try {
            const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, THUMB_W * 2, THUMB_H * 2, true)
            pb.savev(cached, "png", [], [])
            deliver(cached)
        } catch { }
    }
    return null
}

const applyWallpaper = (f: { name: string; path: string; ext: string }) => {
    execAsync(["bash", `${CYBER_DIR}/scripts/set-wallpaper`, f.path]).then((o) => {
        const out = String(o || "").trim()
        if (out) {
            const line = out.split("\n").pop() || ""
            wallStatusSet(false, `// ${line.replace(/\|::\|.*$/, "").slice(0, 60)}`)
        } else {
            GLib.file_set_contents(WALLPAPER_LUA, new TextEncoder().encode(`wallpaper = "${f.path}"\nreturn wallpaper\n`))
            wallStatusSet(true, `// SET ${f.name.toUpperCase()}`)
        }
        ctrl.requestDraw()
    }).catch((e) => {
        wallStatusSet(false, `// SET FAILED: ${String(e).slice(0, 60)}`)
        ctrl.requestDraw()
    })
}

const wallStatusSet = (ok: boolean, msg: string) => { wallState.status = { ok, msg } }
const wallState: { status: { ok: boolean; msg: string } | null } = { status: null }

// reads whatever folder the picker is on, dirs first then the media, skips dotfiles and anything not in
// WALL_EXTS so it dont list random files. the find is async so clicking into another folder fast means
// the old one comes back late and overwrites it, thats why theres a wallPickerDir recheck before setting entries
const loadPickerDir = (dir: string) => {
    wallPickerDir = dir
    wallPickerEntries = []
    wallPickerScroll = 0
    wallPickerLoading = true
    const q = dir.replace(/'/g, `'\\''`)
    sh(`find '${q}' -maxdepth 1 -mindepth 1 \\( -type d -o -type f \\) 2>/dev/null | sort`).then((o) => {
        wallPickerLoading = false
        if (wallPickerDir !== dir) { ctrl?.requestDraw(); return }
        const out = String(o || "").trim()
        const rows = out ? out.split("\n").map((p) => p.trim()).filter(Boolean) : []
        const dirs: typeof wallPickerEntries = []
        const files: typeof wallPickerEntries = []
        for (const p of rows) {
            const name = p.slice(p.lastIndexOf("/") + 1)
            if (name.startsWith(".")) continue
            const isDir = GLib.file_test(p, GLib.FileTest.IS_DIR)
            if (isDir) { dirs.push({ name, path: p, dir: true, ext: "" }); continue }
            const ext = (name.slice(name.lastIndexOf(".") + 1) || "").toLowerCase()
            if (!WALL_EXTS.includes(ext)) continue
            files.push({ name, path: p, dir: false, ext })
        }
        wallPickerEntries = [...dirs, ...files]
        ctrl?.requestDraw()
    })
}

const openPicker = (dir: string) => {
    wallPickerSel = null
    loadPickerDir(dir)
    ctrl.requestDraw()
}

const pickWallpaper = () => {
    if (wallUploading) return
    wallPickerOpen = true
    wallOpen = null
    let start = `${GLib.get_home_dir()}/Pictures`
    if (!GLib.file_test(start, GLib.FileTest.IS_DIR)) start = GLib.get_home_dir()
    openPicker(start)
}

const closePicker = () => {
    wallPickerOpen = false
    wallPickerSel = null
    wallPickerEntries = []
    wallPathEditing = false
    wallPathText = ""
    ctrl.requestDraw()
}

const expandPath = (p: string): string => {
    let s = p.trim()
    if (!s) return GLib.get_home_dir()
    if (s === "~") return GLib.get_home_dir()
    if (s.startsWith("~/")) s = `${GLib.get_home_dir()}/${s.slice(2)}`
    else if (!s.startsWith("/")) s = `${GLib.get_home_dir()}/${s}`
    s = s.replace(/\/+$/, "")
    return s || "/"
}

const commitWallPath = () => {
    const target = expandPath(wallPathText)
    wallPathEditing = false
    if (GLib.file_test(target, GLib.FileTest.IS_DIR)) {
        wallPathText = ""
        openPicker(target)
    } else {
        wallStatusSet(false, "// NO SUCH FOLDER")
        wallPathText = ""
        ctrl.requestDraw()
    }
}

// the tabs sit behind the picker and were grabbing keystrokes, so typing a folder path would flip tabs
// instead of typing. while the path field is focused every key gets caught here and marked handled so
// nothing leaks back to the tabs, when its not focused only escape matters and that closes the picker
export const wallPickerKey = (k: number): boolean => {
    if (!wallPickerOpen) return false
    if (!wallPathEditing) {
        if (k === Gdk.KEY_Escape) { closePicker(); return true }
        return false
    }
    if (k === Gdk.KEY_Escape) { wallPathEditing = false; wallPathText = ""; ctrl.requestDraw(); return true }
    if (k === Gdk.KEY_Return || k === Gdk.KEY_KP_Enter) { commitWallPath(); return true }
    if (k === Gdk.KEY_BackSpace) { wallPathText = wallPathText.slice(0, -1); ctrl.requestDraw(); return true }
    const u = Gdk.keyval_to_unicode(k)
    if (u >= 32 && u < 0x10000) { wallPathText += String.fromCharCode(u); ctrl.requestDraw(); return true }
    return true
}

const importWallpaper = (src: string) => {
    const name = src.slice(src.lastIndexOf("/") + 1)
    const ext = (name.slice(name.lastIndexOf(".") + 1) || "").toLowerCase()
    if (!WALL_EXTS.includes(ext)) {
        wallStatusSet(false, `// UNSUPPORTED TYPE: .${ext || "UNKNOWN"}`)
        ctrl.requestDraw()
        return
    }
    let size = 0
    try { size = Gio.File.new_for_path(src).query_info("standard::size", 0, null).get_size() } catch {
        wallStatusSet(false, "// FILE NOT READABLE")
        ctrl.requestDraw()
        return
    }
    if (size < 1024) {
        wallStatusSet(false, "// FILE TOO SMALL / EMPTY")
        ctrl.requestDraw()
        return
    }
    const dst = `${WALLPAPERS_PATH}/others/${name}`
    const applyFrom = (path: string, label: string) => {
        wallStatusSet(true, `// SETTING ${name.toUpperCase()}…`)
        ctrl.requestDraw()
        execAsync(["bash", `${CYBER_DIR}/scripts/set-wallpaper`, path]).then((o) => {
            const out = String(o || "").trim()
            if (out && /\|::\||did not|not found|failed|died/i.test(out)) {
                wallStatusSet(false, `// SET FAILED: ${out.split("\n").pop()?.replace(/\|::\|.*$/, "").slice(0, 50)}`)
            } else {
                wallStatusSet(true, `// ${label} ${name.toUpperCase()}`)
            }
            ctrl.requestDraw()
        }).catch((e) => {
            wallStatusSet(false, `// SET FAILED: ${String(e).slice(0, 50)}`)
            ctrl.requestDraw()
        })
    }

    if (src === dst) {
        GLib.file_set_contents(WALLPAPER_LUA, new TextEncoder().encode(`wallpaper = "${dst}"\nreturn wallpaper\n`))
        applyFrom(dst, "SET")
        return
    }

    if (isVideoExt(ext)) {
        sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${src}" 2>/dev/null`).then((dur) => {
            if (!(parseFloat(String(dur || "").trim()) > 0)) {
                wallStatusSet(false, "// NOT A VALID VIDEO FILE")
                ctrl.requestDraw()
                return
            }
            GLib.file_set_contents(WALLPAPER_LUA, new TextEncoder().encode(`wallpaper = "${src}"\nreturn wallpaper\n`))
            applyFrom(src, "SET")
            copyToOthers(src, dst)
        })
        return
    }

    GLib.file_set_contents(WALLPAPER_LUA, new TextEncoder().encode(`wallpaper = "${src}"\nreturn wallpaper\n`))
    applyFrom(src, "SET")
    copyToOthers(src, dst)
}

const copyToOthers = (src: string, dst: string) => {
    wallUploading = true
    sh(`mkdir -p "${WALLPAPERS_PATH}/others" && cp -f -- "${src}" "${dst}"`).then(() => {
        wallUploading = false
        if (wallOpen === "others") loadWallFiles("others")
        ctrl.requestDraw()
    })
}

const WALL_FRAME = (): [number, number, number] => USER.sysveil as any
const WALL_TOKEN = (): [number, number, number] => USER.cyan as any

// discarded the previous kiroshi wheel + modal style for settings, not only it was cpu consuming
// but to make it more accurate to the game actual menu layout, with top middle tabs and the design
// ui for buttons, fields etc etc. Created wallpaper selector inspired in the "Skill" sets. I tried
// as fk to recreate that same PCB layout but i couldnt get it right no way, so i gave up and went to
// photoshop. For wallpaper selector it loads a "wheel/menu.png" to render the radial menu, and the
// buttons have their each png asset and their active state aswell, Upon changing theme/colors it just
// applies the tint filter likewise other images 'round here.
const WHEEL_SRC = 1024
const wheelSurf = (): any => {
    if ((wheelSurf as any)._s === undefined) {
        try { (wheelSurf as any)._s = Cairo.ImageSurface.createFromPNG(`${CYBER_DIR}/assets/wheel/menu.png`) }
        catch { (wheelSurf as any)._s = null }
    }
    return (wheelSurf as any)._s
}

const wheelPad = (asset: string, hover: boolean): any => {
    const key = hover ? `${asset}_hover` : asset
    const cache = ((wheelPad as any)._c ||= {})
    if (cache[key] === undefined) {
        try { cache[key] = Cairo.ImageSurface.createFromPNG(`${CYBER_DIR}/assets/wheel/pads/${key}.png`) }
        catch { cache[key] = null }
    }
    return cache[key]
}

const WALL_GLITCH_MS = 167
const wallHoverAt: Record<string, number> = {}
let wallLastHot: string | null = null

const WALL_PADS: { folder: string; asset: string; box: [number, number, number, number] }[] = [
    { folder: "netwatch", asset: "netwatch", box: [355, 60, 667, 260] },
    { folder: "synthwave", asset: "synth", box: [610, 186, 915, 364] },
    { folder: "johnny", asset: "johnny", box: [686, 400, 977, 576] },
    { folder: "kitty", asset: "kitty", box: [611, 624, 909, 799] },
    { folder: "blade_runner", asset: "blade", box: [356, 727, 663, 903] },
    { folder: "bloodmoon", asset: "bloodmoon", box: [96, 616, 400, 783] },
    { folder: "ghost", asset: "ghost", box: [47, 400, 338, 576] },
    { folder: "arctic", asset: "arctic", box: [107, 185, 413, 364] },
    { folder: "others", asset: "other", box: [97, 792, 389, 958] },
]
const WALL_HUB = { asset: "add_wallpaper", box: [368, 387, 652, 602] as [number, number, number, number] }

const wheelTintCache: Record<string, any> = {}
// changing the accent color just re-tints every pad live instead of keeping a separate image set per
// theme. the tint keeps the original shading so lighter themes like arctic come out white instead of
// reddish, and the result is cached per color since re-tinting every frame killed the framerate
const tintedWheel = (surf: any, name: string, col: [number, number, number] | null): any => {
    if (!surf) return null
    if (!col) return surf
    const ck = `${name}|${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)}`
    if (wheelTintCache[ck]) return wheelTintCache[ck]
    try {
        const s = new Cairo.ImageSurface(Cairo.Format.ARGB32, WHEEL_SRC, WHEEL_SRC)
        const c = new Cairo.Context(s)
        c.setSourceSurface(surf, 0, 0); c.paint()
        c.setOperator(26); c.setSourceRGBA(0.5, 0.5, 0.5, 1); c.maskSurface(surf, 0, 0)
        c.setOperator(27); c.setSourceRGBA(col[0], col[1], col[2], 1); c.maskSurface(surf, 0, 0)
        c.setOperator(2)
        s.flush()
        wheelTintCache[ck] = s
        return s
    } catch { return surf }
}
onColorChange(() => { for (const k of Object.keys(wheelTintCache)) delete wheelTintCache[k] })

export const drawWallRing = (ctx, g, x, y, w) => {
    const surf = wheelSurf()
    const topY = y + 4
    const botLimit = Math.min(y + g.h - 12, SCREEN_HEIGHT - 20) - 26
    const side = Math.max(120, Math.min(w, botLimit - topY))
    const ox = x + (w - side) / 2
    const oy = topY + (botLimit - topY - side) / 2
    const scale = side / WHEEL_SRC
    const S = (v: number) => v * scale
    const toScr = (bx: [number, number, number, number]): [number, number, number, number] =>
        [ox + S(bx[0]), oy + S(bx[1]), ox + S(bx[2]), oy + S(bx[3])]

    const frame = WALL_FRAME()
    const tok = WALL_TOKEN()
    const natural = getPaletteName() === "NETWATCH"
    const HOVER_A = 0.5

    if (surf) {
        const menuS = tintedWheel(surf, "menu", natural ? null : frame)
        ctx.save()
        ctx.translate(ox, oy)
        ctx.scale(scale, scale)
        ctx.setSourceSurface(menuS, 0, 0)
        ctx.paintWithAlpha(1)
        ctx.restore()

        const now = Date.now()
        const hoverKey = g.push.hoverKey
        const curHot = hoverKey === "wupload" ? "hub"
            : (typeof hoverKey === "string" && hoverKey.startsWith("wtile|"))
                ? (WALL_PADS.find((p) => `wtile|${p.folder}` === hoverKey)?.folder ?? null)
                : null
        if (curHot && curHot !== wallLastHot) wallHoverAt[curHot] = now
        wallLastHot = curHot

        const rnd = (a: number) => {
            const s = Math.sin(a * 91.37) * 43758.5453
            return (s - Math.floor(s)) * 2 - 1
        }
        // hover pulls the pads _hover.png cause i was crashing out trying to apply a hover effect right on the
        // shape, so the menu options and their hover states are all just images being switched. theres a short
        // glitch on the way in, the image is sliced into bands that slide sideways and settle over WALL_GLITCH_MS,
        // one shot on enter, ends at 50% opacity
        const hot = (id: string, asset: string) => {
            const hov = wheelPad(asset, true)
            if (!hov) return
            const hovS = tintedWheel(hov, `${asset}_h`, natural ? null : tok)
            const started = wallHoverAt[id] ?? now
            const prog = Math.min(1, (now - started) / WALL_GLITCH_MS)
            const ease = prog * prog * (3 - 2 * prog)
            const glitch = 1 - ease

            ctx.save()
            ctx.translate(ox, oy)
            ctx.scale(scale, scale)

            if (glitch <= 0.01) {
                ctx.setSourceSurface(hovS, 0, 0); ctx.paintWithAlpha(HOVER_A)
            } else {
                const bands = 11
                const bh = WHEEL_SRC / bands
                for (let b = 0; b < bands; b++) {
                    const dx = rnd(b + 1) * 34 * glitch
                    ctx.save()
                    ctx.rectangle(0, b * bh, WHEEL_SRC, bh)
                    ctx.clip()
                    ctx.setSourceSurface(hovS, dx, 0)
                    ctx.paintWithAlpha(HOVER_A * (0.4 + 0.6 * ease))
                    ctx.restore()
                }
                g.refresh?.()
            }
            ctx.restore()
        }

        for (const p of WALL_PADS) {
            if (wallOpen === p.folder || hoverKey === `wtile|${p.folder}`) hot(p.folder, p.asset)
        }
        if (hoverKey === "wupload") hot("hub", WALL_HUB.asset)
    } else {
        txt(ctx, x + 10, y + 30, "// wheel/menu.png missing", MONO, 11, frame, 0.8)
    }

    for (const p of WALL_PADS) {
        const [bx0, by0, bx1, by1] = toScr(p.box)
        g.push({ kind: "btn", hoverable: true, key: `wtile|${p.folder}`, bx0, by0, bx1, by1, on: () => openWallTheme(p.folder) })
    }
    const [hx0, hy0, hx1, hy1] = toScr(WALL_HUB.box)
    g.push({ kind: "btn", hoverable: true, key: "wupload", bx0: hx0, by0: hy0, bx1: hx1, by1: hy1, on: () => pickWallpaper() })

    const cx = ox + side / 2
    const st = (wallState as any).status
    if (st) {
        const col = st.ok ? [0.42, 1, 0.6] : [1, 0.4, 0.44]
        ctx.selectFontFace(MONO, 0, 0); ctx.setFontSize(9)
        const tw = ctx.textExtents(st.msg).width
        txt(ctx, cx - tw / 2, oy + side + 14, st.msg, MONO, 9, col, 0.95, 1)
    }
    const cur = readCurrentWallpaper()
    if (cur) {
        const bn = cur.slice(cur.lastIndexOf("/") + 1)
        ctx.selectFontFace(MONO, 0, 0); ctx.setFontSize(8)
        const s = `CURRENT: ${fitTxt(ctx, bn, MONO, 8, w - 40)}`
        const tw = ctx.textExtents(s).width
        txt(ctx, cx - tw / 2, oy + side + 26, s, MONO, 8, g.col, 0.5)
    }
}

export const drawWallBrowse = (ctx, g, x, y, w) => {
    drawBtn(ctx, g.push, x, y, 90, 26, "◂ BACK", () => {
        wallOpen = null
        wallScroll = 0
        ctrl.requestDraw()
    }, false, g.col, "", 10)

    const folderLabel = (WALL_THEMES.find(([, f]) => f === wallOpen) || ["OTHERS", ""])[0]
    txt(ctx, x + 104, y + 17, `// ${folderLabel}`, MONO, 10, g.accent, 0.9, 1)

    const st = (wallState as any).status
    if (st) {
        const col = st.ok ? [0.42, 1, 0.6] : [1, 0.4, 0.44]
        ctx.selectFontFace(MONO, 0, 0); ctx.setFontSize(8.5)
        txt(ctx, x + w - ctx.textExtents(st.msg).width - 4, y + 17, st.msg, MONO, 8.5, col, 0.95, 1)
    }

    const visTop = y + 36, visBottom = g.Y + g.h - 14, visHeight = visBottom - visTop
    if (wallFilesLoading) {
        txt(ctx, x + 10, visTop + 24, "// SCANNING…", MONO, 10, g.col, 0.7)
        return
    }
    if (wallFiles.length === 0) {
        txt(ctx, x + 10, visTop + 24, "// NO WALLPAPERS IN THIS FOLDER", MONO, 10, g.col, 0.7)
        return
    }

    const cols = Math.max(1, Math.floor((w - 8) / (THUMB_W + THUMB_GAP)))
    const rowH = THUMB_H + 34
    const cur = readCurrentWallpaper()
    const totalRows = Math.ceil(wallFiles.length / cols)
    const contentH = totalRows * rowH
    wallMaxScroll = Math.max(0, contentH - visHeight)
    if (wallScroll > wallMaxScroll) wallScroll = wallMaxScroll
    if (wallScroll < 0) wallScroll = 0

    ctx.save()
    ctx.rectangle(x - 4, visTop, w + 8, visHeight)
    ctx.clip()
    wallFiles.forEach((f, i) => {
        const col = i % cols, row = Math.floor(i / cols)
        const tx = x + col * (THUMB_W + THUMB_GAP)
        const ty = visTop + row * rowH - wallScroll
        if (ty + rowH < visTop || ty > visBottom) return
        const active = cur === f.path
        const key = `wthumb|${i}`
        const hovered = g.push.hoverKey === key
        const bc = active ? WALL_TOKEN() : hovered ? WALL_FRAME() : g.col
        ctx.save()
        if (hovered || active) {
            ctx.setOperator(12)
            ctx.rectangle(tx - 3, ty - 3, THUMB_W + 6, THUMB_H + 6); ctx.setSourceRGBA(bc[0], bc[1], bc[2], 0.25); ctx.setLineWidth(4); ctx.stroke()
            ctx.setOperator(2)
        }
        ctx.rectangle(tx, ty, THUMB_W, THUMB_H)
        ctx.setSourceRGBA(bc[0] * 0.12, bc[1] * 0.12, bc[2] * 0.16, 0.5); ctx.fill()
        const pb = getThumb(f.path)
        if (pb) {
            const iw = pb.get_width(), ih = pb.get_height()
            const s = Math.min(THUMB_W / iw, THUMB_H / ih)
            const dw = iw * s, dh = ih * s
            ctx.save()
            ctx.rectangle(tx, ty, THUMB_W, THUMB_H); ctx.clip()
            Gdk.cairo_set_source_pixbuf(ctx, pb, tx + (THUMB_W - dw) / 2, ty + (THUMB_H - dh) / 2)
            ctx.paintWithAlpha(1)
            ctx.restore()
        }
        ctx.setSourceRGBA(bc[0], bc[1], bc[2], active ? 1 : 0.8); ctx.setLineWidth(hovered ? 1.3 : 0.9)
        ctx.rectangle(tx + 0.5, ty + 0.5, THUMB_W - 1, THUMB_H - 1); ctx.stroke()
        ctx.restore()
        const badge = isVideoExt(f.ext) ? "▶" : "▣"
        txt(ctx, tx + 2, ty + THUMB_H + 14, `${badge} ${fitTxt(ctx, f.name, MONO, 8, THUMB_W - 4)}`, MONO, 8, active ? g.accent : g.col, active ? 1 : 0.72)
        g.push({ kind: "btn", hoverable: true, key, bx0: tx, by0: ty, bx1: tx + THUMB_W, by1: ty + THUMB_H, on: () => applyWallpaper(f) })
    })
    ctx.restore()

    if (wallMaxScroll > 0) {
        const fillH = visHeight * (wallScroll / wallMaxScroll)
        const barH = Math.max(20, visHeight - fillH)
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.85); ctx.setLineWidth(3)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop + fillH); ctx.lineTo(x + w + 4, visTop + fillH + barH); ctx.stroke()
    }
}

export const drawWallPicker = (ctx, g, x, y, w) => {
    drawBtn(ctx, g.push, x, y, 90, 26, "◂ BACK", () => {
        closePicker()
    }, false, g.col, "", 10)

    const home = GLib.get_home_dir()
    const parent = wallPickerDir.slice(0, wallPickerDir.lastIndexOf("/")) || "/"
    const canUp = wallPickerDir !== "/" && wallPickerDir.length > 1
    drawBtn(ctx, g.push, x + 96, y, 44, 26, "", () => {
        if (canUp) { wallPathEditing = false; wallPathText = ""; openPicker(parent) }
    }, false, g.accent, ch(0xf062), 12)

    const fieldX = x + 148, fieldW = w - 148 - 108, fieldH = 26
    const shownDir = wallPickerDir.startsWith(home) ? "~" + wallPickerDir.slice(home.length) : wallPickerDir
    const fieldHover = g.push.hoverKey === "wpath"
    const fc = wallPathEditing ? g.accent : fieldHover ? WALL_FRAME() : g.col
    ctx.rectangle(fieldX, y, fieldW, fieldH)
    ctx.setSourceRGBA(fc[0] * 0.12, fc[1] * 0.12, fc[2] * 0.16, wallPathEditing ? 0.6 : 0.4); ctx.fill()
    ctx.setSourceRGBA(fc[0], fc[1], fc[2], wallPathEditing ? 1 : fieldHover ? 0.9 : 0.65); ctx.setLineWidth(wallPathEditing ? 1.3 : 0.9)
    ctx.rectangle(fieldX + 0.5, y + 0.5, fieldW - 1, fieldH - 1); ctx.stroke()
    const fieldStr = wallPathEditing ? `${wallPathText}_` : shownDir
    txt(ctx, fieldX + 8, y + 17, fitTxt(ctx, fieldStr, MONO, 10, fieldW - 16), MONO, 10, wallPathEditing ? g.accent : g.col, wallPathEditing ? 1 : 0.85)
    g.push({
        kind: "btn", hoverable: true, key: "wpath",
        bx0: fieldX, by0: y, bx1: fieldX + fieldW, by1: y + fieldH,
        on: () => {
            wallPathEditing = true
            wallPathText = shownDir
            ctrl.requestDraw()
        }
    })

    const applyOk = !!wallPickerSel && !wallUploading
    drawBtn(ctx, g.push, x + w - 100, y, 100, 26, "APPLY", () => {
        if (applyOk && wallPickerSel) { const p = wallPickerSel.path; closePicker(); importWallpaper(p) }
    }, applyOk, applyOk ? g.accent : g.col, "", 10)

    const st = (wallState as any).status
    if (st) {
        const col = st.ok ? [0.42, 1, 0.6] : [1, 0.4, 0.44]
        ctx.selectFontFace(MONO, 0, 0); ctx.setFontSize(8.5)
        txt(ctx, x + w - ctx.textExtents(st.msg).width - 4, y + 40, st.msg, MONO, 8.5, col, 0.95, 1)
    }

    const visTop = y + 48, visBottom = g.Y + g.h - 14, visHeight = visBottom - visTop
    if (wallPickerLoading) {
        txt(ctx, x + 10, visTop + 24, "// SCANNING…", MONO, 10, g.col, 0.7)
        return
    }
    if (wallPickerEntries.length === 0) {
        txt(ctx, x + 10, visTop + 24, "// EMPTY / NO MEDIA HERE", MONO, 10, g.col, 0.7)
        return
    }

    const cols = Math.max(1, Math.floor((w - 8) / (THUMB_W + THUMB_GAP)))
    const rowH = THUMB_H + 34
    const totalRows = Math.ceil(wallPickerEntries.length / cols)
    const contentH = totalRows * rowH
    wallPickerMaxScroll = Math.max(0, contentH - visHeight)
    if (wallPickerScroll > wallPickerMaxScroll) wallPickerScroll = wallPickerMaxScroll
    if (wallPickerScroll < 0) wallPickerScroll = 0

    ctx.save()
    ctx.rectangle(x - 4, visTop, w + 8, visHeight)
    ctx.clip()
    wallPickerEntries.forEach((e, i) => {
        const col = i % cols, row = Math.floor(i / cols)
        const tx = x + col * (THUMB_W + THUMB_GAP)
        const ty = visTop + row * rowH - wallPickerScroll
        if (ty + rowH < visTop || ty > visBottom) return
        const key = `wpick|${i}`
        const hovered = g.push.hoverKey === key
        const selected = !e.dir && wallPickerSel?.path === e.path
        const bc = selected ? WALL_TOKEN() : hovered ? WALL_FRAME() : g.col
        ctx.save()
        if (hovered || selected) {
            ctx.setOperator(12)
            ctx.rectangle(tx - 3, ty - 3, THUMB_W + 6, THUMB_H + 6); ctx.setSourceRGBA(bc[0], bc[1], bc[2], 0.25); ctx.setLineWidth(4); ctx.stroke()
            ctx.setOperator(2)
        }
        ctx.rectangle(tx, ty, THUMB_W, THUMB_H)
        ctx.setSourceRGBA(bc[0] * 0.12, bc[1] * 0.12, bc[2] * 0.16, 0.5); ctx.fill()
        if (e.dir) {
            ctx.selectFontFace(ICONF, 0, 0); ctx.setFontSize(38)
            ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.92)
            const gl = ch(0xf07b)
            const ge = ctx.textExtents(gl)
            ctx.moveTo(tx + THUMB_W / 2 - ge.width / 2, ty + THUMB_H / 2 + 14); ctx.showText(gl)
        } else {
            const pb = getThumb(e.path)
            if (pb) {
                const iw = pb.get_width(), ih = pb.get_height()
                const s = Math.min(THUMB_W / iw, THUMB_H / ih)
                const dw = iw * s, dh = ih * s
                ctx.save()
                ctx.rectangle(tx, ty, THUMB_W, THUMB_H); ctx.clip()
                Gdk.cairo_set_source_pixbuf(ctx, pb, tx + (THUMB_W - dw) / 2, ty + (THUMB_H - dh) / 2)
                ctx.paintWithAlpha(1)
                ctx.restore()
            }
        }
        ctx.setSourceRGBA(bc[0], bc[1], bc[2], selected ? 1 : 0.8); ctx.setLineWidth(hovered ? 1.3 : 0.9)
        ctx.rectangle(tx + 0.5, ty + 0.5, THUMB_W - 1, THUMB_H - 1); ctx.stroke()
        ctx.restore()
        const badge = e.dir ? "▸" : isVideoExt(e.ext) ? "▶" : "▣"
        txt(ctx, tx + 2, ty + THUMB_H + 14, `${badge} ${fitTxt(ctx, e.name, MONO, 8, THUMB_W - 4)}`, MONO, 8, e.dir ? g.accent : selected ? g.accent : g.col, e.dir || selected ? 1 : 0.72)
        g.push({
            kind: "btn", hoverable: true, key,
            bx0: tx, by0: ty, bx1: tx + THUMB_W, by1: ty + THUMB_H,
            on: () => {
                if (e.dir) { openPicker(e.path) }
                else { wallPickerSel = { name: e.name, path: e.path, ext: e.ext }; ctrl.requestDraw() }
            }
        })
    })
    ctx.restore()

    if (wallPickerMaxScroll > 0) {
        const fillH = visHeight * (wallPickerScroll / wallPickerMaxScroll)
        const barH = Math.max(20, visHeight - fillH)
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.85); ctx.setLineWidth(3)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop + fillH); ctx.lineTo(x + w + 4, visTop + fillH + barH); ctx.stroke()
    }
}

const commitWmApps = () => {
    const apps = wmAppText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    if (apps.length > 0) setWm("wmOpacityApps", apps.join(","))
    wmAppText = ""
    wmAppEditing = false
    ctrl.requestDraw()
}

const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
    const rr = r / 255, gg = g / 255, bb = b / 255
    const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb), d = mx - mn
    let h = 0
    if (d !== 0) {
        if (mx === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60
        else if (mx === gg) h = ((bb - rr) / d + 2) * 60
        else h = ((rr - gg) / d + 4) * 60
    }
    return [h, mx === 0 ? 0 : d / mx, mx]
}
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
    const c = v * s, hh = ((h % 360) + 360) % 360 / 60, x = c * (1 - Math.abs((hh % 2) - 1))
    let r = 0, g = 0, b = 0
    if (hh < 1) { r = c; g = x } else if (hh < 2) { r = x; g = c } else if (hh < 3) { g = c; b = x }
    else if (hh < 4) { g = x; b = c } else if (hh < 5) { r = x; b = c } else { r = c; b = x }
    const m = v - c
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

const openWmPicker = (key: string) => {
    const cur = hexToRgb(wmStr(key))
    if (cur) wmColorPick = { key, ...rgbToHsv(cur[0], cur[1], cur[2]) }
    else wmColorPick = { key, h: 0, s: 0.85, v: 0.95 }
    wmOpen = null
    ctrl.requestDraw()
}
const liveWmPick = () => {
    if (!wmColorPick) return
    const [r, gg, b] = hsvToRgb(wmColorPick.h, wmColorPick.s, wmColorPick.v)
    setWm(wmColorPick.key, rgbToHex([r, gg, b]).replace(/^#/, ""))
    ctrl.requestDraw()
}
const closeWmPicker = () => { wmColorPick = null; ctrl.requestDraw() }

const drawColorCell = (ctx, g, x, ry, h, rgb: [number, number, number] | null) => {
    if (rgb) ctx.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1)
    else { ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.18) }
    ctx.rectangle(x, ry, h, h); ctx.fill()
    ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.8); ctx.setLineWidth(1)
    ctx.rectangle(x + 0.5, ry + 0.5, h - 1, h - 1); ctx.stroke()
}

const hexToRgb = (h: string): [number, number, number] | null => {
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const drawWmSlider = (ctx, g, x, ry, w, key, min, max, fmt) => {
    const trackX = x + w - 250, trackW = 200
    const v = wmNum(key)
    const norm = Math.max(0, Math.min(1, (v - min) / (max - min)))
    drawSlider(ctx, g.push, trackX, ry + 14, trackW, norm, (nv) => {
        setWm(key, Math.round((min + nv * (max - min)) * 100) / 100)
    })
    txt(ctx, trackX - 52, ry + 19, fmt(v), MONO, 11, g.accent, 0.9, 0, 0)
}

const WM_SECTIONS: { title: string; keys: string[]; rows: { t: "tog" | "sld" | "sel" | "col" | "car" | "apps" | "corner"; k: string; label: string; grp?: string }[] }[] = [
    {
        title: "// ::window transparency",
        keys: ["wmOpacity", "wmOpacityVal", "wmOpacityMode", "wmOpacityApps"],
        rows: [
            { t: "tog", k: "wmOpacity", label: "WINDOW BACKGROUND TRANSPARENCY" },
            { t: "sld", k: "wmOpacityVal", label: "OPACITY LEVEL" },
            { t: "sel", k: "wmOpacityMode", label: "APPLICATION MODE" },
            { t: "apps", k: "wmOpacityApps", label: "SELECTED APPLICATIONS" },
        ],
    },
    {
        title: "// ::glow & shadow",
        keys: ["wmGlow", "wmGlowRange", "wmGlowRp", "wmShadow", "wmShadowColor", "wmShadowAlpha", "wmShadowRange"],
        rows: [
            { t: "tog", k: "wmGlow", label: "WINDOW GLOW" },
            { t: "sld", k: "wmGlowRange", label: "GLOW RANGE" },
            { t: "sld", k: "wmGlowRp", label: "GLOW INTENSITY" },
            { t: "tog", k: "wmShadow", label: "WINDOW SHADOW" },
            { t: "col", k: "wmShadowColor", label: "SHADOW COLOUR" },
            { t: "sld", k: "wmShadowAlpha", label: "SHADOW STRENGTH" },
            { t: "sld", k: "wmShadowRange", label: "SHADOW RANGE" },
        ],
    },
    {
        title: "// ::borders",
        keys: ["wmBorders", "wmBorderSize", "wmBorderColor"],
        rows: [
            { t: "tog", k: "wmBorders", label: "WINDOW BORDERS" },
            { t: "sld", k: "wmBorderSize", label: "BORDER WIDTH" },
            { t: "col", k: "wmBorderColor", label: "BORDER COLOUR" },
        ],
    },
    {
        title: "// ::corners",
        keys: ["wmCorners", "wmRounding"],
        rows: [
            { t: "sel", k: "wmCorners", label: "CORNER STYLE" },
            { t: "sld", k: "wmRounding", label: "CORNER SIZE" },
        ],
    },
]

const drawWmRow = (ctx, g, x, ry, w, r, hit) => {
    const push = hit ? g.push : noPush
    const lx = r.grp ? x + 30 : x + 16
    const dis = r.k === "wmOpacityVal" ? !wmBool("wmOpacity")
        : r.k === "wmRounding" ? wmCornersIs("sharp")
        : false

    if (r.t === "car") {
        const open = wmExpand[r.k] === true
        drawBtn(ctx, push, x + 16, ry + 4, 300, 24, `${open ? "▾" : "▸"}  ${r.label}`, () => { wmExpand[r.k] = !open; wmOpen = null; ctrl.requestDraw() }, open, open ? (USER.cyan as any) : g.col, "", 12)
        return
    }

    if (r.t === "tog") {
        txt(ctx, lx, ry + 21, r.label, TITLE, 12, g.col, 0.9)
        drawToggle(ctx, push, x + w - 58, ry + 4, wmBool(r.k), () => { toggleWm(r.k) }, false, g.col, 1.35, USER.cyan as any)
        return
    }

    if (r.t === "sld") {
        txt(ctx, lx, ry + 21, r.label, TITLE, 12, dis ? [0.5, 0.54, 0.58] : g.col, dis ? 0.38 : 0.9)
        if (dis) return
        const fmts: Record<string, (v: number) => string> = {
            wmOpacityVal: (v) => `${Math.round(v * 100)}%`,
            wmBorderSize: (v) => `${Math.round(v)}px`,
            wmGlowRange: (v) => `${Math.round(v)}px`,
            wmGlowRp: (v) => `x${Math.round(v)}`,
            wmShadowRange: (v) => `${Math.round(v)}px`,
            wmShadowAlpha: (v) => `${Math.round(v)}%`,
            wmRounding: (v) => `${Math.round(v)}px`,
        }
        const ranges: Record<string, [number, number]> = {
            wmOpacityVal: [0.4, 1], wmBorderSize: [0, 20], wmGlowRange: [0, 30], wmGlowRp: [1, 5],
            wmShadowRange: [0, 40], wmShadowAlpha: [10, 100], wmRounding: [0, 40],
        }
        drawWmSlider(ctx, g, x, ry, w, r.k, ranges[r.k]?.[0] ?? 0, ranges[r.k]?.[1] ?? 1, fmts[r.k] ?? ((v) => `${v}`))
        return
    }

    if (r.t === "col") {
        txt(ctx, lx, ry + 21, r.label, TITLE, 12, g.col, 0.9)
        const cur = wmStr(r.k)
        const rgb = hexToRgb(cur)
        const picking = wmColorPick?.key === r.k
        const label = cur ? `#${cur}` : "THEME"
        drawColorCell(ctx, g, x + w - 140, ry + 4, 24, rgb)
        push({ kind: "btn", bx0: x + w - 144, by0: ry + 2, bx1: x + w - 56, by1: ry + 30, on: () => { if (!picking) openWmPicker(r.k) } })
        txt(ctx, x + w - 110, ry + 21, label, MONO, 11, rgb ? g.accent : g.col, 0.9)
        drawBtn(ctx, push, x + w - 52, ry + 4, 48, 24, picking ? "OPEN" : "PICK", () => {
            if (!picking) openWmPicker(r.k)
        }, picking, g.col, "", 11)
        return
    }

    if (r.t === "apps") {
        const apps = wmStr(r.k).split(",").map((s) => s.trim()).filter(Boolean)
        const mode = wmStr("wmOpacityMode")
        const editing = wmAppEditing && wmAppText !== ""
        const shown = editing ? `${wmAppText}_` : apps.length ? apps.join(", ") : "NONE"
        const editable = mode !== "off"
        txt(ctx, lx, ry + 21, r.label, TITLE, 12, editable ? g.col : [0.5, 0.54, 0.58], editable ? 0.9 : 0.38)
        if (!editable) return
        txt(ctx, lx + 250, ry + 21, fitTxt(ctx, shown, MONO, 10.5, w - 420), MONO, 10.5, editing ? g.accent : g.col, editing ? 1 : 0.7)
        drawBtn(ctx, push, x + w - 52, ry + 4, 48, 24, editing ? "OK" : "EDIT", () => {
            if (editing) commitWmApps()
            else { wmAppEditing = true; wmAppText = ""; ctrl.requestDraw() }
        }, editing, g.col, "", 11)
        return
    }

    const isCorner = r.k === "wmCorners"
    const isMode = r.k === "wmOpacityMode"
    const opts = isCorner ? CORNER_OPTS : isMode ? OPACITY_MODES : []
    const labels = isCorner ? CORNER_LABEL : isMode ? OPACITY_MODE_LABEL : {}
    const cur = wmStr(r.k), open = wmOpen === r.k
    txt(ctx, lx, ry + 21, r.label, TITLE, 12, g.col, 0.9)
    drawBtn(ctx, push, x + w - 302, ry + 3, 300, 26, `${labels[cur] ?? cur}   ${open ? "▴" : "▾"}`, () => { wmOpen = open ? null : r.k; ctrl.requestDraw() }, open, g.col, "", 12.5)
}

export const drawWm = (ctx, g, x, y, w) => {
    const visTop = y + 16, visBottom = g.Y + g.h - 14, visHeight = visBottom - visTop

    const layout: { y: number; kind: "sec" | "row"; title: string; sec?: { title: string; keys: string[]; rows: any[] }; row?: any }[] = []
    let yAcc = 0
    for (const sec of WM_SECTIONS) {
        layout.push({ y: yAcc, kind: "sec", title: sec.title, sec })
        yAcc += GSEC_H
        for (const r of sec.rows) {
            if (r.grp && !wmExpand[r.grp]) continue
            layout.push({ y: yAcc, kind: "row", title: r.label, row: r }); yAcc += GROW_H
        }
        yAcc += 10
    }

    const maxScroll = Math.max(0, yAcc + 12 - visHeight)
    kbMaxScroll = maxScroll
    if (kbScroll > maxScroll) kbScroll = maxScroll
    if (kbScroll < 0) kbScroll = 0

    let pop: { key: string; bx: number; by: number; bw: number } | null = null
    let colAnchor: number | null = null

    ctx.save()
    ctx.rectangle(x - 4, visTop, w + 8, visHeight)
    ctx.clip()
    for (const it of layout) {
        const ry = visTop + it.y - kbScroll
        if (it.kind === "sec") {
            if (ry + GSEC_H < visTop || ry > visBottom) continue
            sectionHeader(ctx, g, x, ry + 16, it.sec!.title, w - 92, 12)
            const shown = ry >= visTop - 1 && ry + 24 <= visBottom + 1
            drawBtn(ctx, (shown && !wmColorPick && !wmOpen) ? g.push : noPush, x + w - 88, ry + 1, 88, 22, "DEFAULTS", () => { resetWm(it.sec!.keys); wmOpen = null; ctrl.requestDraw() }, false, [1, 0.4, 0.44], "", 11)
            continue
        }
        if (ry + GROW_H < visTop || ry > visBottom) continue
        const hit = ry >= visTop - 1 && ry + GROW_H <= visBottom + 1
        const r = it.row!
        if (r.t === "sel" && wmOpen === r.k) pop = { key: r.k, bx: x + w - 302, by: ry + 29, bw: 300 }
        if (r.t === "col" && wmColorPick?.key === r.k) colAnchor = ry
        drawWmRow(ctx, g, x, ry, w, r, hit && !wmOpen && !wmColorPick)
    }
    ctx.restore()

    if (maxScroll > 0) {
        const fillH = visHeight * (kbScroll / maxScroll)
        const barH = Math.max(20, visHeight - fillH)
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.85); ctx.setLineWidth(3)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop + fillH); ctx.lineTo(x + w + 4, visTop + fillH + barH); ctx.stroke()
    }

    if (pop) {
        const isCorner = pop.key === "wmCorners"
        const opts = isCorner ? CORNER_OPTS : OPACITY_MODES
        const labels = isCorner ? CORNER_LABEL : OPACITY_MODE_LABEL
        const ih = 27, listH = opts.length * ih + 8
        let ly = pop.by + 2
        if (ly + listH > visBottom) ly = Math.max(visTop, pop.by - 33 - listH)
        ctx.setSourceRGBA(0.02, 0.05, 0.07, 0.97); ctx.rectangle(pop.bx, ly, pop.bw, listH); ctx.fill()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.7); ctx.setLineWidth(1)
        ctx.rectangle(pop.bx + 0.5, ly + 0.5, pop.bw - 1, listH - 1); ctx.stroke()
        const cur = wmStr(pop.key)
        opts.forEach((o, i) => {
            drawBtn(ctx, g.push, pop!.bx + 3, ly + 3 + i * ih, pop!.bw - 6, ih - 2, labels[o] ?? o, () => { setWm(pop!.key, o); wmOpen = null; ctrl.requestDraw() }, cur === o, cur === o ? (USER.cyan as any) : g.col, "", 12)
        })
        g.push({ kind: "btn", bx0: g.X, by0: g.Y, bx1: g.X + g.w, by1: g.Y + g.h, on: () => { wmOpen = null; ctrl.requestDraw() } })
    }

    if (wmColorPick) {
        const p = wmColorPick
        const pW = 300, pH = 300
        const px = x + w - pW - 8
        let py = colAnchor != null ? colAnchor + 30 : visTop + (visHeight - pH) / 2
        if (py + pH > visBottom) py = Math.max(visTop, (colAnchor != null ? colAnchor - pH - 8 : visTop) )
        const sx = px + 16, sy = py + 16, svw = 190, svh = 190
        const hx = px + 16, hy = py + 232, hw = 190, hh = 18
        const [ar, ag, ab] = hsvToRgb(p.h, p.s, p.v)
        ctx.setSourceRGBA(0.02, 0.05, 0.07, 0.98); ctx.rectangle(px, py, pW, pH); ctx.fill()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.7); ctx.setLineWidth(1)
        ctx.rectangle(px + 0.5, py + 0.5, pW - 1, pH - 1); ctx.stroke()

        const [hr, hg, hb] = hsvToRgb(p.h, 1, 1)
        const gws = new Cairo.LinearGradient(sx, 0, sx + svw, 0)
        gws.addColorStopRGB(0, 1, 1, 1); gws.addColorStopRGB(1, hr / 255, hg / 255, hb / 255)
        ctx.setSource(gws); ctx.rectangle(sx, sy, svw, svh); ctx.fill()
        const gbs = new Cairo.LinearGradient(0, sy, 0, sy + svh)
        gbs.addColorStopRGBA(0, 0, 0, 0, 0); gbs.addColorStopRGBA(1, 0, 0, 0, 1)
        ctx.setSource(gbs); ctx.rectangle(sx, sy, svw, svh); ctx.fill()
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.4); ctx.setLineWidth(1)
        ctx.rectangle(sx + 0.5, sy + 0.5, svw - 1, svh - 1); ctx.stroke()

        ctx.setSourceRGB(ar / 255, ag / 255, ab / 255)
        ctx.rectangle(px + 222, sy, 62, 156); ctx.fill()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.8); ctx.setLineWidth(1)
        ctx.rectangle(px + 222.5, sy + 0.5, 61, 155); ctx.stroke()
        txt(ctx, px + 222, sy + 176, rgbToHex([ar, ag, ab]), MONO, 10.5, g.accent, 0.95)

        const ghu = new Cairo.LinearGradient(hx, 0, hx + hw, 0)
        for (let i = 0; i <= 6; i++) { const [r2, g2, b2] = hsvToRgb(i * 60, 1, 1); ghu.addColorStopRGB(i / 6, r2 / 255, g2 / 255, b2 / 255) }
        ctx.setSource(ghu); ctx.rectangle(hx, hy, hw, hh); ctx.fill()
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.4); ctx.setLineWidth(1)
        ctx.rectangle(hx + 0.5, hy + 0.5, hw - 1, hh - 1); ctx.stroke()

        const ccx = sx + p.s * svw, ccy = sy + (1 - p.v) * svh
        ctx.setSourceRGBA(0, 0, 0, 0.8); ctx.setLineWidth(1)
        ctx.newPath(); ctx.arc(ccx, ccy, 8, 0, 2 * Math.PI); ctx.stroke()
        ctx.setSourceRGBA(1, 1, 1, 0.95); ctx.setLineWidth(1.8)
        ctx.newPath(); ctx.arc(ccx, ccy, 6.4, 0, 2 * Math.PI); ctx.stroke()
        const hcx = hx + (p.h / 360) * hw
        ctx.setSourceRGBA(0, 0, 0, 0.8); ctx.setLineWidth(4)
        ctx.newPath(); ctx.moveTo(hcx, hy - 4); ctx.lineTo(hcx, hy + hh + 4); ctx.stroke()
        ctx.setSourceRGBA(1, 1, 1, 0.95); ctx.setLineWidth(1.6)
        ctx.newPath(); ctx.moveTo(hcx, hy - 4); ctx.lineTo(hcx, hy + hh + 4); ctx.stroke()

        drawBtn(ctx, g.push, px + 16, py + pH - 38, 96, 28, "THEME", () => { setWm(p.key, ""); closeWmPicker() }, false, [1, 0.4, 0.44], "", 11)
        drawBtn(ctx, g.push, px + 124, py + pH - 38, 96, 28, "DONE", () => closeWmPicker(), true, g.col, "", 11)

        g.push({
            kind: "sld2", key: "wmPickSV", bx0: sx - 3, by0: sy - 3, bx1: sx + svw + 3, by1: sy + svh + 3,
            onXY: (mx, my) => {
                p.s = Math.max(0, Math.min(1, (mx - sx) / svw))
                p.v = Math.max(0, Math.min(1, 1 - (my - sy) / svh))
                liveWmPick()
            },
        })
        g.push({
            kind: "sld", key: "wmPickHue", u0: hx, v0: hy + hh / 2, u1: hx + hw, v1: hy + hh / 2,
            bx0: hx - 5, by0: hy - 5, bx1: hx + hw + 5, by1: hy + hh + 5,
            on: (t) => { p.h = t * 360; liveWmPick() },
        })
        g.push({ kind: "btn", bx0: px, by0: py, bx1: px + pW, by1: py + pH, on: () => {} })
        g.push({ kind: "btn", bx0: g.X, by0: g.Y, bx1: g.X + g.w, by1: g.Y + g.h, on: () => closeWmPicker() })
    }
}

type CfgKind = "tog" | "snd" | "sel" | "car"
type CfgRow = { t: CfgKind; k: string; label: string; dep?: string; grp?: string; master?: boolean }

const CFG_SECTIONS: [string, CfgRow[]][] = [
    ["// ::animations", [
        { t: "tog", k: "anim", label: "TOGGLE ANIMATIONS", master: true },
        { t: "tog", k: "animWorkspace", label: "WORKSPACE-SWITCH ANIMATION" },
        { t: "tog", k: "animGlitch", label: "WORKSPACE GLITCH OVERLAY" },
        { t: "tog", k: "animModal", label: "MODAL / SYSTEM POPUP ANIMATIONS" },
        { t: "tog", k: "animGauge", label: "MONITOR GAUGES ANIMATION" },
        { t: "tog", k: "animNotif", label: "NOTIFICATION ANIMATIONS" },
        { t: "tog", k: "animMusic", label: "MUSIC PLAYER ANIMATIONS" },
        { t: "tog", k: "animWheel", label: "QUICKHACK WHEEL ANIMATIONS" },
    ]],

    ["// ::sound", [
        { t: "tog", k: "snd", label: "THEME SOUNDS & NOTIFICATIONS", master: true },

        { t: "tog", k: "sndNotif", label: "NOTIFICATION SOUNDS" },
        { t: "snd", k: "sndNotifFile", label: "NOTIFY" },

        { t: "tog", k: "sndWheel", label: "QUICKHACK WHEEL SOUNDS" },
        { t: "car", k: "wheelGrp", label: "WHEEL SAMPLES", dep: "sndWheel" },
            { t: "snd", k: "sndWheelStart", label: "START", grp: "wheelGrp" },
            { t: "snd", k: "sndWheelActive", label: "ACTIVE", grp: "wheelGrp" },
            { t: "snd", k: "sndWheelEnd", label: "END", grp: "wheelGrp" },

        { t: "tog", k: "sndOverlay", label: "OVERLAY SOUNDS" },
        { t: "car", k: "ovlGrp", label: "OVERLAY SAMPLES", dep: "sndOverlay" },
            { t: "snd", k: "sndOverlayFile", label: "OVERLAY", grp: "ovlGrp" },
            { t: "snd", k: "sndKillFile", label: "KILL_APP", grp: "ovlGrp" },
    ]],

    ["// ::gauge monitors", [
        { t: "sel", k: "gaugeBadge", label: "BADGE" }, { t: "sel", k: "gaugeXp", label: "EXPERIENCE BAR" },
        { t: "sel", k: "gaugeHealth", label: "HEALTH BAR" }, { t: "sel", k: "gaugeRam", label: "RAM BAR" },
        { t: "sel", k: "gaugeStamina", label: "STAMINA BAR" },
    ]],
]

const CFG_DEP: Record<string, string> = {
    animWorkspace: "anim", animGlitch: "anim", animModal: "anim", animGauge: "anim", animNotif: "anim", animMusic: "anim", animWheel: "anim",
    sndNotif: "snd", sndNotifFile: "sndNotif",
    sndWheel: "snd", sndWheelStart: "sndWheel", sndWheelActive: "sndWheel", sndWheelEnd: "sndWheel",
    sndOverlay: "snd", sndOverlayFile: "sndOverlay", sndKillFile: "sndOverlay",
}
const CFG_FALLBACK: Record<string, string> = {
    sndNotifFile: "notif.mp3",
    sndWheelStart: "kiroshi_on.ogg", sndWheelActive: "kiroshi_menu.ogg", sndWheelEnd: "kiroshi_off.ogg",
    sndOverlayFile: "active.ogg", sndKillFile: "kill.ogg",
}

let cfgOpen: string | null = null
let cfgExpand: Record<string, boolean> = {}
let extPicker = ""
sh("for c in zenity kdialog yad; do command -v $c >/dev/null 2>&1 && { echo $c; break; }; done").then((o) => { extPicker = String(o || "").trim() })

const GROW_H = 34, GSEC_H = 46
const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1)
const cfgLocked = (k: string): boolean => {
    let p = CFG_DEP[k]
    while (p) { if (!cfgBool(p)) return true; p = CFG_DEP[p] }
    return false
}

const pickGtk = (key: string) => {
    try {
        const dlg = new Gtk.FileChooserDialog({ title: "SELECT AUDIO", action: Gtk.FileChooserAction.OPEN, modal: true })
        dlg.add_button("CANCEL", Gtk.ResponseType.CANCEL); dlg.add_button("SELECT", Gtk.ResponseType.ACCEPT)
        const flt = new Gtk.FileFilter(); flt.set_name("AUDIO")
        for (const p of ["*.ogg", "*.oga", "*.mp3", "*.wav", "*.flac", "*.opus"]) flt.add_pattern(p)
        dlg.add_filter(flt)
        try { dlg.set_current_folder(GLib.get_home_dir()) } catch {}
        const res = dlg.run(), file = res === Gtk.ResponseType.ACCEPT ? dlg.get_filename() : null
        dlg.destroy()
        if (file) { adoptSound(key, file); ctrl.requestDraw() }
    } catch (e) { print("[cfg] pick:", e) }
}
const pickSound = (key: string) => {
    if (!extPicker) { pickGtk(key); return }
    const cmd = extPicker === "kdialog"
        ? `kdialog --getopenfilename "$HOME" 'Audio (*.ogg *.oga *.mp3 *.wav *.flac *.opus)' 2>/dev/null`
        : extPicker === "yad"
            ? `yad --file --title="SELECT AUDIO" --file-filter='AUDIO | *.ogg *.oga *.mp3 *.wav *.flac *.opus' 2>/dev/null`
            : `zenity --file-selection --title="SELECT AUDIO" --file-filter='AUDIO | *.ogg *.oga *.mp3 *.wav *.flac *.opus' 2>/dev/null`
    sh(cmd).then((o) => {
        const p = String(o || "").trim().split("\n")[0]
        if (p) { adoptSound(key, p); ctrl.requestDraw() }
    })
}

const fitTxt = (ctx, s: string, font: string, fs: number, maxW: number) => {
    ctx.selectFontFace(font, 0, 0); ctx.setFontSize(fs)
    if (ctx.textExtents(s).width <= maxW) return s
    let out = s
    while (out.length > 1 && ctx.textExtents(out + "…").width > maxW) out = out.slice(0, -1)
    return out + "…"
}

const drawCfgRow = (ctx, g, x, ry, w, r: CfgRow, hit: boolean) => {
    const push = hit ? g.push : noPush
    const dis = cfgLocked(r.k) || (r.dep ? (!cfgBool(r.dep) || cfgLocked(r.dep)) : false)
    const lx = r.master ? x : r.grp ? x + 30 : x + 16, la = dis ? 0.38 : r.master ? 1 : 0.9, lcol = r.master ? g.accent : g.col

    if (r.t === "car") {
        const open = cfgExpand[r.k] === true
        drawBtn(ctx, push, x + 16, ry + 4, 260, 24, `${open ? "▾" : "▸"}  ${r.label}`, () => { cfgExpand[r.k] = !open; cfgOpen = null; ctrl.requestDraw() }, open, open ? (USER.cyan as any) : (dis ? [0.5, 0.54, 0.58] : g.col), "", 12)
        return
    }

    txt(ctx, lx, ry + 21, r.label, TITLE, r.master ? 13 : 12, lcol, la, 1, r.master ? 0.3 : 0)

    if (r.t === "tog") {
        drawToggle(ctx, push, x + w - 58, ry + 4, cfgBool(r.k), () => { toggleCfg(r.k); cfgOpen = null; ctrl.requestDraw() }, dis, g.col, 1.35, USER.cyan as any)
        return
    }

    if (r.t === "snd") {
        const cur = cfgStr(r.k)
        const shown = cur ? baseName(cur) : `DEFAULT :: ${CFG_FALLBACK[r.k] ?? ""}`
        const tx = lx + 120
        txt(ctx, tx, ry + 21, fitTxt(ctx, shown, MONO, 10.5, x + w - 140 - tx), MONO, 10.5, cur ? g.accent : g.col, dis ? 0.32 : cur ? 0.85 : 0.55)
        drawBtn(ctx, push, x + w - 122, ry + 4, 76, 24, "PICK", () => pickSound(r.k), false, dis ? [0.5, 0.54, 0.58] : g.col, "", 12)
        if (cur) drawBtn(ctx, push, x + w - 38, ry + 4, 32, 24, "×", () => { clearSound(r.k); ctrl.requestDraw() }, false, dis ? [0.5, 0.54, 0.58] : [1, 0.4, 0.44], "", 12)
        return
    }

    const cur = cfgStr(r.k), open = cfgOpen === r.k
    drawBtn(ctx, push, x + w - 302, ry + 3, 300, 26, `${METRIC_LABEL[cur] ?? cur}   ${open ? "▴" : "▾"}`, () => { cfgOpen = open ? null : r.k; ctrl.requestDraw() }, open, g.col, "", 12.5)
}

export const drawConfig = (ctx, g, x, y, w) => {
    const gate = cfgOpen ? noPush : g.push
    const bh = 38, half = (w - 10) / 2
    drawBtn(ctx, gate, x, y, half, bh, "LOAD USER DIR", () => sh(`xdg-open "${USER_DIR}"`), false, g.col, "", 13)
    drawBtn(ctx, gate, x + half + 10, y, half, bh, "RELOAD CYBERARCH", () => { reloadHyprland() }, false, g.col, "", 13)

    const visTop = y + bh + 20, visBottom = g.Y + g.h - 14, visHeight = visBottom - visTop

    const layout: { y: number; kind: "sec" | "row"; label: string; row?: CfgRow; keys?: string[] }[] = []
    let yAcc = 0
    for (const [title, rows] of CFG_SECTIONS) {
        layout.push({ y: yAcc, kind: "sec", label: title, keys: rows.filter((r) => r.t !== "car").map((r) => r.k) })
        yAcc += GSEC_H
        for (const r of rows) {
            if (r.grp && !cfgExpand[r.grp]) continue
            layout.push({ y: yAcc, kind: "row", label: r.label, row: r }); yAcc += GROW_H
        }
        yAcc += 10
    }

    const maxScroll = Math.max(0, yAcc + 12 - visHeight)
    kbMaxScroll = maxScroll
    if (kbScroll > maxScroll) kbScroll = maxScroll
    if (kbScroll < 0) kbScroll = 0

    let pop: { key: string; bx: number; by: number; bw: number } | null = null

    ctx.save()
    ctx.rectangle(x - 4, visTop, w + 8, visHeight)
    ctx.clip()
    for (const it of layout) {
        const ry = visTop + it.y - kbScroll
        if (it.kind === "sec") {
            if (ry + GSEC_H < visTop || ry > visBottom) continue
            sectionHeader(ctx, g, x, ry + 16, it.label, w - 92, 12)
            const shown = ry >= visTop - 1 && ry + 24 <= visBottom + 1
            drawBtn(ctx, shown ? gate : noPush, x + w - 88, ry + 1, 88, 22, "DEFAULTS", () => { resetCfg(it.keys ?? []); cfgOpen = null; ctrl.requestDraw() }, false, [1, 0.4, 0.44], "", 11)
            continue
        }
        if (ry + GROW_H < visTop || ry > visBottom) continue
        const hit = ry >= visTop - 1 && ry + GROW_H <= visBottom + 1
        const r = it.row!
        if (r.t === "sel" && cfgOpen === r.k) pop = { key: r.k, bx: x + w - 302, by: ry + 29, bw: 300 }
        drawCfgRow(ctx, g, x, ry, w, r, hit && !cfgOpen)
    }
    ctx.restore()

    if (maxScroll > 0) {
        const fillH = visHeight * (kbScroll / maxScroll)
        const barH = Math.max(20, visHeight - fillH)
        ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.5); ctx.setLineWidth(2)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop); ctx.lineTo(x + w + 4, visBottom); ctx.stroke()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.85); ctx.setLineWidth(3)
        ctx.newPath(); ctx.moveTo(x + w + 4, visTop + fillH); ctx.lineTo(x + w + 4, visTop + fillH + barH); ctx.stroke()
    }

    if (pop) {
        const opts = GAUGE_OPTS[pop.key] ?? []
        const ih = 27, listH = opts.length * ih + 8
        let ly = pop.by + 2
        if (ly + listH > visBottom) ly = Math.max(visTop, pop.by - 33 - listH)
        ctx.setSourceRGBA(0.02, 0.05, 0.07, 0.97); ctx.rectangle(pop.bx, ly, pop.bw, listH); ctx.fill()
        ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.7); ctx.setLineWidth(1)
        ctx.rectangle(pop.bx + 0.5, ly + 0.5, pop.bw - 1, listH - 1); ctx.stroke()
        const cur = cfgStr(pop.key)
        opts.forEach((o, i) => {
            drawBtn(ctx, g.push, pop!.bx + 3, ly + 3 + i * ih, pop!.bw - 6, ih - 2, METRIC_LABEL[o] ?? o, () => { setCfg(pop!.key, o); cfgOpen = null; ctrl.requestDraw() }, cur === o, cur === o ? (USER.cyan as any) : g.col, "", 12)
        })
        g.push({ kind: "btn", bx0: g.X, by0: g.Y, bx1: g.X + g.w, by1: g.Y + g.h, on: () => { cfgOpen = null; ctrl.requestDraw() } })
    }
}
