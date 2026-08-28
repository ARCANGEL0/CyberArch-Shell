import { execAsync } from "astal"
import GLib from "gi://GLib"
import { CYBER_DIR } from "../../env.ts"
import { Keymode } from "./widget.ts"
import { PALETTES, getPaletteName, applyPalette, saveUserColors, setUserColor, getUserColor, rgbToHex } from "./colors.ts"
import { TITLE, MONO, CYAN, ACC, HEADER, txt, drawGlass, Cairo } from "./glass.ts"
import { createModal, drawBtn, drawSlider, sectionHeader } from "./cmodal.ts"
import { openWheel, closeWheel } from "./appsmenu.ts"

const sh = (c) => execAsync(["sh", "-c", c]).catch(() => "")
const UKF = `${CYBER_DIR}/config/user_keybinds.lua`

const wm = { border_size: 4, gaps_in: 12, gaps_out: 24, rounding: 0, shadow_range: 8 }
const anim = { on: true, speed: 4 }
let selPalette = "NETWATCH"

const readTune = () => {
    try {
        const [ok, bytes] = GLib.file_get_contents(UKF)
        if (ok) {
            const src = new TextDecoder().decode(bytes)
            const g = (k, d) => { const m = new RegExp(k + "\\s*=\\s*(\\d+)").exec(src); return m ? parseInt(m[1]) : d }
            wm.border_size = g("border_size", 4)
            wm.gaps_in = g("gaps_in", 12)
            wm.gaps_out = g("gaps_out", 24)
            wm.rounding = g("rounding", 0)
            wm.shadow_range = g("shadow_range", 8)
            const a = /animations\s*=\s*"(\w+)"/.exec(src)
            if (a) anim.on = a[1] === "on"
            anim.speed = g("anim_speed", 4)
        }
    } catch { }
    selPalette = getPaletteName()
}

const writeTune = () => {
    const out = `-- user keybind overrides, maintainable from the theme settings modal.\nlocal admin = {}\nadmin["themeMod"] = "SUPER + SHIFT"\nadmin["tune"] = {\n` +
        `  border_size = ${wm.border_size},\n  gaps_in = ${wm.gaps_in},\n  gaps_out = ${wm.gaps_out},\n` +
        `  rounding = ${wm.rounding},\n  shadow_range = ${wm.shadow_range},\n  animations = "${anim.on ? "on" : "off"}",\n  anim_speed = ${anim.speed},\n}\nreturn admin\n`
    try { GLib.mkdir_with_parents(`${CYBER_DIR}/config`, 0o755); GLib.file_set_contents(UKF, out) } catch (e) { print("[ts] writeTune:", e) }
}

const applyWm = () => {
    sh(`hyprctl keyword general:border_size ${wm.border_size}`)
    sh(`hyprctl keyword general:gaps_in ${wm.gaps_in}`)
    sh(`hyprctl keyword general:gaps_out ${wm.gaps_out}`)
    sh(`hyprctl keyword decoration:rounding ${wm.rounding}`)
    sh(`hyprctl keyword decoration:shadow_range ${wm.shadow_range}`)
    writeTune()
}

const applyAnim = () => {
    sh(`hyprctl keyword animations:enabled ${anim.on ? 1 : 0}`)
    writeTune()
}

const applyColors = (name: string) => { applyPalette(name); saveUserColors(); selPalette = name }

const TABS: [string, string][] = [
    ["COLORS", "colors"], ["KEYBINDS", "keybinds"], ["WM", "wm"], ["ANIM", "anim"], ["WALLPAPER", "wall"],
]
let tab = "colors"
let ctrl: any = null

const wheelEntries = () => TABS.map(([label, id]) => ({ label, badge: label === "COLORS" ? "PAL" : label === "WM" ? "TUNE" : "", glyph: null, data: id }))

export const ThemesCtrl = () => {
    readTune()
    ctrl = createModal({
        name: "themesettings", tabTitle: "THEME", W: 360, H: 625, yaw: 15, pitch: 0, roll: 0,
        anchorRight: true, noBuiltinClose: true, noGlass: true, keymode: Keymode.ON_DEMAND,
        onOpen: () => { readTune(); openWheel({ title: "THEME SETTINGS", subtitle: "// RICE.CTL :: COLOUR & WM TUNING", footer: "[ SCROLL ] SWITCH TAB   [ ESC ] CLOSE", searchable: false, onActivate: (d) => { tab = d; ctrl.requestDraw() }, onFocus: (d) => { if (tab !== d) { tab = d; ctrl.requestDraw() } }, onReset: () => ctrl.close(), emptyText: "// NO TABS" }, wheelEntries()) },
        onClose: () => { closeWheel() },
        draw: (ctx, g) => {
            const panelX = g.X, panelW = g.w, panelY = g.Y, panelH = g.h
            drawGlass(ctx, panelX, panelY, panelW, panelH, g.col)
            txt(ctx, panelX + 16, panelY + 27, "THEME SETTINGS", TITLE, 14, g.accent, 0.98, 1, 0.45)
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.32); ctx.setLineWidth(1)
            ctx.newPath(); ctx.moveTo(panelX + 8, panelY + HEADER); ctx.lineTo(panelX + panelW - 8, panelY + HEADER); ctx.stroke()
            const x = panelX + 18, w = panelW - 36
            if (tab === "colors") drawColors(ctx, g, x, panelY + HEADER + 12, w)
            else if (tab === "keybinds") drawKeybinds(ctx, g, x, panelY + HEADER + 12, w)
            else if (tab === "wm") drawWm(ctx, g, x, panelY + HEADER + 12, w)
            else if (tab === "anim") drawAnim(ctx, g, x, panelY + HEADER + 12, w)
            else drawWall(ctx, g, x, panelY + HEADER + 12, w)
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

const KEYROWS: [string, string][] = [
    ["SUPER + TAB", "LAUNCHER"], ["themeMod + V", "VOLUME"], ["themeMod + P", "POWER"],
    ["themeMod + N", "NETWORKS"], ["themeMod + B", "BLUETOOTH"], ["themeMod + C", "CPU/RAM"],
    ["themeMod + H", "KEYBINDS"], ["themeMod + S", "SCREENSHOT"], ["themeMod + G", "MARKETS"],
]
const drawKeybinds = (ctx, g, x, y, w) => {
    sectionHeader(ctx, g, x, y, "// THEME PREFIX", w)
    txt(ctx, x, y + 20, "SUPER + SHIFT (modifiable later)", MONO, 10, g.col, 0.85)
    const lY = y + 46
    sectionHeader(ctx, g, x, lY, "// QUICK REFERENCE", w)
    const step = 26
    KEYROWS.forEach(([k, act], i) => {
        const ry = lY + 12 + i * step
        txt(ctx, x, ry, k, MONO, 9.5, g.accent, 0.9, 1)
        txt(ctx, x + w - ctx.textExtents(act).width, ry, act, TITLE, 10.5, g.col, 0.8, 1)
    })
}

const drawWm = (ctx, g, x, y, w) => {
    sectionHeader(ctx, g, x, y, "// BORDERS & GAPS", w)
    const trackW = w - 60
    const rows: [string, number, number, number, (v: number) => void][] = [
        ["BORDER SIZE", 1, 8, wm.border_size, (v) => { wm.border_size = Math.round(v); applyWm(); g.refresh() }],
        ["GAPS IN", 2, 30, wm.gaps_in, (v) => { wm.gaps_in = Math.round(v); applyWm(); g.refresh() }],
        ["GAPS OUT", 4, 44, wm.gaps_out, (v) => { wm.gaps_out = Math.round(v); applyWm(); g.refresh() }],
        ["ROUNDING", 0, 24, wm.rounding, (v) => { wm.rounding = Math.round(v); applyWm(); g.refresh() }],
        ["SHADOW", 0, 24, wm.shadow_range, (v) => { wm.shadow_range = Math.round(v); applyWm(); g.refresh() }],
    ]
    rows.forEach(([label, lo, hi, val, on], i) => {
        const ry = y + 16 + i * 52
        txt(ctx, x, ry, label, MONO, 10, g.accent, 0.9, 1)
        const frac = (val - lo) / (hi - lo)
        drawSlider(ctx, g.push, x, ry + 18, trackW, frac, (t) => on(lo + t * (hi - lo)))
        txt(ctx, x + trackW + 14, ry + 24, `${val}`, TITLE, 13, CYAN, 0.95, 1)
    })
    const footY = y + 16 + rows.length * 52 + 8
    drawBtn(ctx, g.push, x, footY, w, 30, "RESET WM TUNING", () => { wm.border_size = 4; wm.gaps_in = 12; wm.gaps_out = 24; wm.rounding = 0; wm.shadow_range = 8; applyWm(); g.refresh() }, false, [1, 0.4, 0.44])
}

const drawAnim = (ctx, g, x, y, w) => {
    sectionHeader(ctx, g, x, y, "// ANIMATION", w)
    drawBtn(ctx, g.push, x, y + 16, w, 34, anim.on ? "ANIMATIONS: ON" : "ANIMATIONS: OFF", () => { anim.on = !anim.on; applyAnim(); g.refresh() }, anim.on, g.col)
    const ry = y + 66
    txt(ctx, x, ry, "SPEED", MONO, 10, g.accent, 0.9, 1)
    const trackW = w - 60
    drawSlider(ctx, g.push, x, ry + 18, trackW, (anim.speed - 1) / 8, (t) => { anim.speed = Math.round(1 + t * 8); writeTune(); g.refresh() })
    txt(ctx, x + trackW + 14, ry + 24, `${anim.speed}`, TITLE, 13, CYAN, 0.95, 1)
    txt(ctx, x, ry + 56, "anim_speed lives in config/user_keybinds.lua", MONO, 9, g.col, 0.55)
}

const drawWall = (ctx, g, x, y, w) => {
    sectionHeader(ctx, g, x, y, "// WALLPAPER", w)
    txt(ctx, x, y + 26, "wallpaper picker coming soon — drop a theme-ready", MONO, 10, g.col, 0.6)
    txt(ctx, x, y + 44, "image into assets/img/ and it will be listed here.", MONO, 10, g.col, 0.6)
    drawBtn(ctx, g.push, x, y + 70, w, 30, "APPLY DEFAULT", () => sh(`awww img '$HOME/drive/MITA/wallpaper.jpg'`), false, g.col)
}
