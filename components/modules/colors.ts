import GLib from "gi://GLib"
import GdkPixbufLib from "gi://Gdk?version=3.0"
import { CYBER_DIR } from "../../env.ts"

export type RGB = [number, number, number]

export const f = (c: RGB): [number, number, number] =>
    [c[0] / 255, c[1] / 255, c[2] / 255]

export const NEON: Record<string, RGB> = {
    red: [255, 42, 58],
    cyan: [94, 244, 248],
    magenta: [228, 50, 200],
    green: [80, 240, 150],
    amber: [255, 178, 36],
    blue: [60, 120, 255],
    white: [225, 232, 242],
    dim: [80, 80, 100],
    grid: [40, 50, 70],
    dock: [94, 244, 248],
    press: [255, 42, 58],
    badge: [94, 244, 248],
    stamina: [80, 240, 150],
    ram: [94, 244, 248],
    netinfo: [255, 222, 105],
    cpu: [252, 113, 115],
    notifred: [255, 74, 68],
    notifyel: [255, 214, 46],
    notifcyn: [108, 230, 246],
    goldf: [112, 94, 26],
    goldd: [74, 61, 15],
    notifgrey: [178, 184, 192],
    glyphcol: [175, 48, 42],
    msggrey: [120, 130, 140],
    dimred: [80, 15, 15],
    appsred: [251, 109, 97],
    hudcyan: [85, 222, 255],
    darkred: [120, 36, 40],
    notifbadge: [240, 24, 20],
    aurgreen: [43, 225, 133],
    aurbrt: [150, 255, 200],
    aurblack: [6, 14, 9],
    aurwht: [232, 255, 240],
    f25: [242, 91, 86],
    overlay: [255, 42, 58],
    pure: [255, 255, 255],
    glassacc: [196, 248, 255],
}

export type PaletteName = "NETWATCH" | "DARK" | "KITTY" | "BLOODMOON" | "ARCTIC" | "SYNTHWAVE" | "JOHNNY" | "GHOST"

export const PALETTES: Record<string, Partial<Record<string, RGB>>> = {
    NETWATCH: {
        red: [255, 42, 58], cyan: [94, 244, 248], magenta: [228, 50, 200],
        green: [80, 240, 150], amber: [255, 178, 36], blue: [60, 120, 255],
        white: [225, 232, 242], dim: [80, 80, 100], grid: [40, 50, 70],
        dock: [94, 244, 248], press: [255, 42, 58], badge: [85, 222, 255],
        stamina: [80, 240, 150], ram: [85, 222, 255], netinfo: [255, 222, 105],
        cpu: [252, 113, 115],
        notifred: [255, 74, 68],
        notifyel: [255, 214, 46],
        notifcyn: [108, 230, 246],
        goldf: [112, 94, 26],
        goldd: [74, 61, 15],
        notifgrey: [178, 184, 192],
        glyphcol: [175, 48, 42],
        msggrey: [120, 130, 140],
        dimred: [80, 15, 15],
        appsred: [251, 109, 97],
        hudcyan: [85, 222, 255],
        darkred: [120, 36, 40],
        notifbadge: [240, 24, 20],
        aurgreen: [43, 225, 133],
        aurbrt: [150, 255, 200],
        aurblack: [6, 14, 9],
        aurwht: [232, 255, 240],
        f25: [242, 91, 86],
        pure: [255, 255, 255],
        glassacc: [196, 248, 255],
        overlay: [255, 42, 58],
    },
    DARK: {
        red: [0, 0, 0], cyan: [0, 0, 0], magenta: [0, 0, 0],
        green: [0, 0, 0], amber: [0, 0, 0], blue: [0, 0, 0],
        white: [255, 255, 255], dim: [10, 10, 12], grid: [0, 0, 0],
        dock: [0, 0, 0], press: [255, 20, 45], badge: [255, 20, 45],
        stamina: [255, 20, 45], ram: [0, 0, 0], netinfo: [0, 0, 0],
        cpu: [0, 0, 0],
        notifred: [0, 0, 0],
        notifyel: [0, 0, 0],
        notifcyn: [0, 0, 0],
        goldf: [8, 8, 10],
        goldd: [4, 4, 5],
        notifgrey: [255, 255, 255],
        glyphcol: [0, 0, 0],
        msggrey: [10, 10, 12],
        dimred: [0, 0, 0],
        appsred: [0, 0, 0],
        hudcyan: [255, 20, 45],
        darkred: [0, 0, 0],
        notifbadge: [255, 20, 45],
        aurgreen: [0, 0, 0],
        aurbrt: [255, 255, 255],
        aurblack: [0, 0, 0],
        aurwht: [255, 255, 255],
        f25: [0, 0, 0],
        pure: [255, 255, 255],
        glassacc: [255, 255, 255],
        overlay: [0, 0, 0],
    },
    KITTY: {
        red: [255, 65, 185], cyan: [225, 110, 255], magenta: [255, 80, 210],
        green: [255, 150, 230], amber: [255, 150, 205], blue: [210, 140, 255],
        white: [255, 240, 250], dim: [150, 95, 160], grid: [35, 15, 40],
        dock: [255, 65, 185], press: [225, 110, 255], badge: [255, 105, 200],
        stamina: [255, 150, 230], ram: [225, 110, 255], netinfo: [255, 80, 210],
        cpu: [255, 65, 185],
        notifred: [255, 65, 185],
        notifyel: [255, 150, 205],
        notifcyn: [255, 65, 185],
        goldf: [76, 45, 61],
        goldd: [45, 27, 36],
        notifgrey: [255, 240, 250],
        glyphcol: [255, 65, 185],
        msggrey: [150, 95, 160],
        dimred: [255, 65, 185],
        appsred: [255, 65, 185],
        hudcyan: [255, 105, 200],
        darkred: [255, 65, 185],
        notifbadge: [255, 105, 200],
        aurgreen: [255, 150, 230],
        aurbrt: [255, 240, 250],
        aurblack: [35, 15, 40],
        aurwht: [255, 240, 250],
        f25: [255, 65, 185],
        pure: [255, 240, 250],
        glassacc: [255, 240, 250],
        overlay: [255, 80, 210],
    },
    BLOODMOON: {
        red: [255, 32, 32], cyan: [255, 60, 60], magenta: [255, 40, 60],
        green: [255, 70, 50], amber: [255, 90, 50], blue: [220, 40, 50],
        white: [255, 210, 205], dim: [130, 50, 50], grid: [50, 10, 14],
        dock: [255, 50, 50], press: [255, 20, 20], badge: [255, 60, 60],
        stamina: [255, 60, 60], ram: [255, 50, 50], netinfo: [255, 60, 60],
        cpu: [255, 32, 32],
        notifred: [255, 32, 32],
        notifyel: [255, 90, 50],
        notifcyn: [255, 50, 50],
        goldf: [76, 27, 15],
        goldd: [45, 16, 9],
        notifgrey: [255, 210, 205],
        glyphcol: [255, 32, 32],
        msggrey: [130, 50, 50],
        dimred: [255, 32, 32],
        appsred: [255, 32, 32],
        hudcyan: [255, 60, 60],
        darkred: [255, 32, 32],
        notifbadge: [255, 60, 60],
        aurgreen: [255, 70, 50],
        aurbrt: [255, 210, 205],
        aurblack: [50, 10, 14],
        aurwht: [255, 210, 205],
        f25: [255, 32, 32],
        pure: [255, 210, 205],
        glassacc: [255, 210, 205],
        overlay: [255, 32, 32],
    },
    ARCTIC: {
        red: [255, 255, 255], cyan: [210, 245, 255], magenta: [255, 255, 255],
        green: [225, 250, 255], amber: [255, 255, 255], blue: [200, 235, 255],
        white: [255, 255, 255], dim: [150, 175, 200], grid: [40, 56, 84],
        dock: [255, 255, 255], press: [190, 240, 255], badge: [255, 255, 255],
        stamina: [220, 250, 255], ram: [210, 248, 255], netinfo: [255, 255, 255],
        cpu: [255, 255, 255],
        notifred: [255, 255, 255],
        notifyel: [255, 255, 255],
        notifcyn: [255, 255, 255],
        goldf: [40, 56, 84],
        goldd: [26, 38, 58],
        notifgrey: [255, 255, 255],
        glyphcol: [255, 255, 255],
        msggrey: [150, 175, 200],
        dimred: [255, 255, 255],
        appsred: [255, 255, 255],
        hudcyan: [255, 255, 255],
        darkred: [170, 200, 220],
        notifbadge: [255, 255, 255],
        aurgreen: [225, 250, 255],
        aurbrt: [255, 255, 255],
        aurblack: [40, 56, 84],
        aurwht: [255, 255, 255],
        f25: [255, 255, 255],
        pure: [255, 255, 255],
        glassacc: [255, 255, 255],
        overlay: [255, 255, 255],
    },
    SYNTHWAVE: {
        red: [255, 45, 150], cyan: [45, 220, 210], magenta: [230, 60, 220],
        green: [170, 90, 255], amber: [255, 165, 60], blue: [90, 70, 230],
        white: [250, 232, 250], dim: [120, 85, 150], grid: [45, 20, 70],
        dock: [255, 45, 190], press: [255, 55, 170], badge: [255, 165, 60],
        stamina: [80, 255, 140], ram: [255, 20, 147], netinfo: [70, 230, 110],
        cpu: [45, 220, 210],
        notifred: [255, 50, 160],
        notifyel: [255, 165, 60],
        notifcyn: [45, 220, 210],
        goldf: [70, 30, 80],
        goldd: [40, 16, 48],
        notifgrey: [225, 195, 225],
        glyphcol: [45, 220, 210],
        msggrey: [130, 90, 150],
        dimred: [255, 50, 160],
        appsred: [255, 50, 160],
        hudcyan: [55, 210, 205],
        darkred: [150, 110, 170],
        notifbadge: [255, 55, 190],
        aurgreen: [45, 220, 210],
        aurbrt: [250, 232, 250],
        aurblack: [35, 15, 55],
        aurwht: [250, 232, 250],
        f25: [255, 50, 160],
        pure: [250, 232, 250],
        glassacc: [80, 255, 140],
        overlay: [255, 60, 190],
    },
    JOHNNY: {
        red: [255, 208, 60], cyan: [94, 244, 248], magenta: [110, 90, 220],
        green: [255, 214, 90], amber: [255, 232, 130], blue: [70, 110, 190],
        white: [250, 246, 228], dim: [130, 116, 70], grid: [40, 50, 84],
        dock: [70, 110, 190], press: [255, 208, 60], badge: [94, 244, 248],
        stamina: [94, 244, 248], ram: [70, 110, 190], netinfo: [70, 110, 190],
        cpu: [255, 208, 60],
        notifred: [255, 208, 60],
        notifyel: [255, 232, 130],
        notifcyn: [70, 110, 190],
        goldf: [76, 69, 39],
        goldd: [45, 41, 23],
        notifgrey: [250, 246, 228],
        glyphcol: [255, 208, 60],
        msggrey: [130, 116, 70],
        dimred: [255, 208, 60],
        appsred: [255, 208, 60],
        hudcyan: [94, 244, 248],
        darkred: [255, 208, 60],
        notifbadge: [94, 244, 248],
        aurgreen: [255, 214, 90],
        aurbrt: [250, 246, 228],
        aurblack: [40, 50, 84],
        aurwht: [250, 246, 228],
        f25: [255, 208, 60],
        pure: [250, 246, 228],
        glassacc: [250, 246, 228],
        overlay: [255, 208, 60],
    },
    GHOST: {
        red: [0, 255, 120], cyan: [40, 255, 140], magenta: [40, 200, 120],
        green: [60, 255, 120], amber: [120, 255, 90], blue: [30, 160, 90],
        white: [200, 255, 220], dim: [40, 90, 60], grid: [10, 22, 16],
        dock: [40, 255, 140], press: [80, 255, 140], badge: [255, 60, 40],
        stamina: [40, 255, 140], ram: [40, 255, 140], netinfo: [40, 255, 140],
        cpu: [0, 255, 120],
        notifred: [0, 255, 120],
        notifyel: [120, 255, 90],
        notifcyn: [40, 255, 140],
        goldf: [36, 76, 27],
        goldd: [21, 45, 16],
        notifgrey: [200, 255, 220],
        glyphcol: [0, 255, 120],
        msggrey: [40, 90, 60],
        dimred: [0, 255, 120],
        appsred: [0, 255, 120],
        hudcyan: [255, 60, 40],
        darkred: [0, 255, 120],
        notifbadge: [255, 60, 40],
        aurgreen: [60, 255, 120],
        aurbrt: [200, 255, 220],
        aurblack: [10, 22, 16],
        aurwht: [200, 255, 220],
        f25: [0, 255, 120],
        pure: [200, 255, 220],
        glassacc: [200, 255, 220],
        overlay: [0, 255, 120],
    },
}

export const USER: Record<string, [number, number, number]> = {
    red: f(NEON.red), cyan: f(NEON.cyan), magenta: f(NEON.magenta),
    green: f(NEON.green), amber: f(NEON.amber), blue: f(NEON.blue),
    white: f(NEON.white), dim: f(NEON.dim), grid: f(NEON.grid),
    dock: f(NEON.dock), press: f(NEON.press), badge: f(NEON.badge),
    stamina: f(NEON.stamina), ram: f(NEON.ram), netinfo: f(NEON.netinfo), cpu: f(NEON.cpu),
    notifred: f(NEON.notifred), notifyel: f(NEON.notifyel), notifcyn: f(NEON.notifcyn), goldf: f(NEON.goldf), goldd: f(NEON.goldd), notifgrey: f(NEON.notifgrey), glyphcol: f(NEON.glyphcol), msggrey: f(NEON.msggrey), dimred: f(NEON.dimred), appsred: f(NEON.appsred), hudcyan: f(NEON.hudcyan), darkred: f(NEON.darkred), notifbadge: f(NEON.notifbadge), aurgreen: f(NEON.aurgreen), aurbrt: f(NEON.aurbrt), aurblack: f(NEON.aurblack), aurwht: f(NEON.aurwht), f25: f(NEON.f25), pure: f(NEON.pure), overlay: f(NEON.overlay), glassacc: f(NEON.glassacc),
}

export const imgTint = { value: null as RGB | null, strength: 0 }
const IMG_TINT: Record<string, [RGB, number]> = {
    ARCTIC: [[255, 255, 255], 1],
    DARK: [[0, 0, 0], 0.97],
    KITTY: [[255, 80, 210], 0.85],
    JOHNNY: [[255, 208, 60], 0.85],
    BLOODMOON: [[255, 32, 32], 0.9],
    GHOST: [[0, 255, 120], 0.88],
    SYNTHWAVE: [[255, 60, 220], 0.85],
}
const updateImgTint = (name: string) => {
    const e = IMG_TINT[name]
    imgTint.value = e ? e[0] : null
    imgTint.strength = e ? e[1] : 0
}

export const tintSurface = (ctx: any, surf: any, w: number, h: number, a = 1, colorOverride: RGB | null = null) => {
    const tc = colorOverride || imgTint.value
    if (!tc || !surf) return
    try {
        ctx.setSourceSurface(surf, 0, 0); ctx.paintWithAlpha(a)
        ctx.setOperator(27)
        ctx.setSourceRGBA(tc[0] / 255, tc[1] / 255, tc[2] / 255, imgTint.strength * a)
        ctx.maskSurface(surf, 0, 0)
        ctx.setOperator(2)
    } catch {}
}

export const tintSurfaceFlat = (ctx: any, surf: any, w: number, h: number, a = 1, colorOverride: RGB | null = null) => {
    const tc = colorOverride || imgTint.value
    if (!tc || !surf) return
    try {
        ctx.setSourceSurface(surf, 0, 0)
        const pat = ctx.getSource()
        ctx.setSourceRGBA(tc[0] / 255, tc[1] / 255, tc[2] / 255, imgTint.strength * a)
        ctx.mask(pat)
    } catch {}
}

export const tintOpaque = (ctx: any, w: number, h: number, a = 1) => {
    const tc = imgTint.value
    if (!tc) return
    ctx.save()
    ctx.rectangle(0, 0, w, h); ctx.clip()
    ctx.setOperator(27); ctx.setSourceRGBA(tc[0] / 255, tc[1] / 255, tc[2] / 255, imgTint.strength * a); ctx.paint()
    ctx.setOperator(2)
    ctx.restore()
}

export const tintPixbuf = (ctx: any, pb: any, x: number, y: number, a = 1) => {
    const tc = imgTint.value
    if (!tc || !pb) return
    try {
        GdkPixbufLib.cairo_set_source_pixbuf(ctx, pb, x, y)
        const pat = ctx.getSource()
        ctx.paintWithAlpha(a)
        ctx.setOperator(27)
        ctx.setSourceRGBA(tc[0] / 255, tc[1] / 255, tc[2] / 255, imgTint.strength * a)
        ctx.mask(pat)
        ctx.setOperator(2)
    } catch {}
}

const GLASS_ALPHA: Record<string, number> = { GHOST: 0.14, DARK: 0.85 }
export const glassAlpha = { value: 1 }
const updateGlassAlpha = (name: string) => { glassAlpha.value = GLASS_ALPHA[name] ?? 1 }

const GLASS_MODE: Record<string, boolean> = { ARCTIC: true, DARK: true }
export const glassMode = { value: false }
const updateGlassMode = (name: string) => { glassMode.value = GLASS_MODE[name] ?? false }

type MenuBg = { bg: RGB; bgA: number; fog: RGB | null; fogA: number }
const MENU_BG_DEF: MenuBg = { bg: [2, 1, 4], bgA: 0.5, fog: [255, 42, 58], fogA: 0.18 }
const MENU_BG: Record<string, MenuBg> = {
    NETWATCH: { bg: [2, 1, 4], bgA: 0.5, fog: [255, 42, 58], fogA: 0.18 },
    ARCTIC: { bg: [2, 1, 4], bgA: 0.42, fog: [255, 255, 255], fogA: 0.18 },
    KITTY: { bg: [10, 2, 8], bgA: 0.5, fog: [255, 65, 185], fogA: 0.2 },
    JOHNNY: { bg: [2, 4, 10], bgA: 0.5, fog: [255, 208, 60], fogA: 0.18 },
    DARK: { bg: [0, 0, 0], bgA: 0.55, fog: [140, 15, 30], fogA: 0.22 },
    BLOODMOON: { bg: [6, 0, 0], bgA: 0.5, fog: [255, 32, 32], fogA: 0.2 },
    GHOST: { bg: [0, 6, 3], bgA: 0.45, fog: [0, 255, 120], fogA: 0.18 },
    SYNTHWAVE: { bg: [6, 0, 10], bgA: 0.5, fog: [255, 60, 220], fogA: 0.2 },
}
export const menuBg = { ...MENU_BG_DEF }
const updateMenuBg = (name: string) => {
    const e = MENU_BG[name] ?? MENU_BG_DEF
    menuBg.bg = e.bg; menuBg.bgA = e.bgA; menuBg.fog = e.fog; menuBg.fogA = e.fogA
}

type MapAccent = { clock: RGB; city: RGB; forecast: RGB | null }
const MAP_ACCENT_DEF: MapAccent = { clock: [130, 231, 215], city: [176, 255, 157], forecast: null }
const MAP_ACCENT: Record<string, MapAccent> = {
    ARCTIC: { clock: [255, 255, 255], city: [130, 220, 255], forecast: null },
    SYNTHWAVE: { clock: [255, 60, 220], city: [100, 255, 170], forecast: [255, 60, 220] },
    JOHNNY: { clock: [255, 208, 60], city: [176, 255, 157], forecast: null },
}
export const mapAccent = { ...MAP_ACCENT_DEF }
const updateMapAccent = (name: string) => {
    const e = MAP_ACCENT[name] ?? MAP_ACCENT_DEF
    mapAccent.clock = e.clock; mapAccent.city = e.city; mapAccent.forecast = e.forecast
}

type RGB01 = [number, number, number]
type HudSoft = { acc: RGB01; label: RGB01 }
const HUD_SOFT_DEF: HudSoft = { acc: [1, 0.58, 0.55], label: [1, 0.64, 0.6] }
const HUD_SOFT: Record<string, HudSoft> = {
    ARCTIC: { acc: [1, 1, 1], label: [1, 1, 1] },
    KITTY: { acc: [1, 0.2549, 0.7255], label: [1, 0.4118, 0.7843] },
}
export const hudSoft = { ...HUD_SOFT_DEF }
const updateHudSoft = (name: string) => {
    const e = HUD_SOFT[name] ?? HUD_SOFT_DEF
    hudSoft.acc = e.acc; hudSoft.label = e.label
}

const NEON_BTN: Record<string, boolean> = { DARK: true }
export const neonBtn = { value: false }
const updateNeonBtn = (name: string) => { neonBtn.value = NEON_BTN[name] ?? false }

const CIRCLE_TINT: Record<string, RGB> = { DARK: [255, 20, 45] }
export const circleTint = { value: null as RGB | null }
const updateCircleTint = (name: string) => { circleTint.value = CIRCLE_TINT[name] ?? null }

const LAUNCHER_TINT: Record<string, RGB> = { SYNTHWAVE: [45, 220, 210] }
export const launcherTint = { value: null as RGB | null }
const updateLauncherTint = (name: string) => { launcherTint.value = LAUNCHER_TINT[name] ?? null }

const LAUNCHER_LABEL_TINT: Record<string, RGB> = { JOHNNY: [255, 208, 60] }
export const launcherLabelTint = { value: null as RGB | null }
const updateLauncherLabelTint = (name: string) => { launcherLabelTint.value = LAUNCHER_LABEL_TINT[name] ?? null }

type RadioBg = { color: RGB; alpha: number }
const RADIO_BG: Record<string, RadioBg> = { JOHNNY: { color: [255, 208, 60], alpha: 0.16 } }
export const radioBg = { value: null as RadioBg | null }
const updateRadioBg = (name: string) => { radioBg.value = RADIO_BG[name] ?? null }

const NOTIF_BUBBLE: Record<string, RGB> = { NETWATCH: [94, 244, 248] }
export const notifBubble = { value: NOTIF_BUBBLE.NETWATCH as RGB | null }
const updateNotifBubble = (name: string) => { notifBubble.value = NOTIF_BUBBLE[name] ?? null }

const changeBus: Array<() => void> = []
export const onColorChange = (cb: () => void): (() => void) => { changeBus.push(cb); return () => { const i = changeBus.indexOf(cb); if (i >= 0) changeBus.splice(i, 1) } }
const notifyColorChange = () => { for (const cb of [...changeBus]) { try { cb() } catch (e) { print("[color] notify:", e) } } }

const setColor = (key: string, [r, g, b]: RGB, notify = true) => {
    const ne = NEON[key], us = USER[key]
    if (ne) { ne[0] = r; ne[1] = g; ne[2] = b }
    if (us) { us[0] = r / 255; us[1] = g / 255; us[2] = b / 255 }
    if (notify) notifyColorChange()
}

export const hexToRgb = (hex: string): RGB | null => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [n >> 16 & 255, n >> 8 & 255, n & 255]
}

export const rgbToHex = ([r, g, b]: RGB) =>
    "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")

export const applyPalette = (name: string) => {
    const p = PALETTES[name]
    if (!p) return
    for (const k of Object.keys(p)) setColor(k, p[k] as RGB)
    updateGlassAlpha(name)
    updateImgTint(name)
    updateMenuBg(name)
    updateMapAccent(name)
    updateHudSoft(name)
    updateGlassMode(name)
    updateNeonBtn(name)
    updateCircleTint(name)
    updateLauncherTint(name)
    updateLauncherLabelTint(name)
    updateRadioBg(name)
    updateNotifBubble(name)
}

export const getPaletteName = (): string => {
    for (const name of Object.keys(PALETTES)) {
        const p = PALETTES[name]
        let match = true
        for (const k of Object.keys(p)) {
            const c = NEON[k]
            if (!c || Math.abs(c[0] - (p[k] as RGB)[0]) > 2 || Math.abs(c[1] - (p[k] as RGB)[1]) > 2 || Math.abs(c[2] - (p[k] as RGB)[2]) > 2) { match = false; break }
        }
        if (match) return name
    }
    return "NETWATCH"
}

export const setUserColor = (key: string, rgb: RGB) => { setColor(key, rgb) }

export const getUserColor = (key: string): RGB => [NEON[key][0], NEON[key][1], NEON[key][2]] as RGB

const COLOR_KEYS = Object.keys(NEON)
const USER_PATH = `${CYBER_DIR}/config/user_colors.lua`

export const loadUserColors = (): void => {
    try {
        const [ok, bytes] = GLib.file_get_contents(USER_PATH)
        if (!ok) return
        const src = new TextDecoder().decode(bytes)
        for (const line of src.split("\n")) {
            const m = /users\["(\w+)"\]\s*=\s*\{?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(line)
            if (m && COLOR_KEYS.includes(m[1])) setColor(m[1], [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])] as RGB)
        }
        updateGlassAlpha(getPaletteName())
        updateImgTint(getPaletteName())
        updateMenuBg(getPaletteName())
        updateMapAccent(getPaletteName())
        updateHudSoft(getPaletteName())
        updateGlassMode(getPaletteName())
        updateNeonBtn(getPaletteName())
        updateCircleTint(getPaletteName())
        updateLauncherTint(getPaletteName())
        updateLauncherLabelTint(getPaletteName())
        updateRadioBg(getPaletteName())
        updateNotifBubble(getPaletteName())
    } catch (e) { print("[color] load:", e) }
}

export const saveUserColors = (): void => {
    try {
        let out = "local users = {}\n"
        for (const k of COLOR_KEYS) {
            const c = NEON[k]
            out += `users["${k}"] = { ${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])} }\n`
        }
        const dir = `${CYBER_DIR}/config`
        GLib.mkdir_with_parents(dir, 0o755)
        GLib.file_set_contents(USER_PATH, out)
    } catch (e) { print("[color] save:", e) }
}
