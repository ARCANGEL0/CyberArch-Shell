import GLib from "gi://GLib"
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
}

export type PaletteName = "NETWATCH" | "DARK" | "KITTY" | "BLOODMOON" | "ARCTIC" | "SYNTHWAVE" | "JOHNNY" | "GHOST"

export const PALETTES: Record<string, Partial<Record<string, RGB>>> = {
    NETWATCH: {
        red: [255, 42, 58], cyan: [94, 244, 248], magenta: [228, 50, 200],
        green: [80, 240, 150], amber: [255, 178, 36], blue: [60, 120, 255],
        white: [225, 232, 242], dim: [80, 80, 100], grid: [40, 50, 70],
        dock: [94, 244, 248], press: [255, 42, 58], badge: [94, 244, 248],
        stamina: [80, 240, 150], ram: [94, 244, 248], netinfo: [255, 222, 105],
        cpu: [252, 113, 115],
    },
    DARK: {
        red: [3, 3, 4], cyan: [3, 3, 4], magenta: [3, 3, 4],
        green: [3, 3, 4], amber: [3, 3, 4], blue: [3, 3, 4],
        white: [255, 255, 255], dim: [10, 10, 12], grid: [0, 0, 0],
        dock: [3, 3, 4], press: [255, 20, 45], badge: [3, 3, 4],
        stamina: [255, 20, 45], ram: [60, 220, 255], netinfo: [3, 3, 4],
        cpu: [3, 3, 4],
    },
    KITTY: {
        red: [255, 65, 185], cyan: [225, 110, 255], magenta: [255, 80, 210],
        green: [255, 200, 240], amber: [255, 150, 205], blue: [210, 140, 255],
        white: [255, 240, 250], dim: [150, 95, 160], grid: [35, 15, 40],
        dock: [225, 110, 255], press: [255, 65, 185], badge: [255, 235, 248],
        stamina: [225, 110, 255], ram: [225, 110, 255], netinfo: [225, 110, 255],
        cpu: [255, 65, 185],
    },
    BLOODMOON: {
        red: [255, 32, 32], cyan: [255, 90, 80], magenta: [220, 20, 90],
        green: [255, 80, 40], amber: [255, 110, 40], blue: [180, 30, 50],
        white: [255, 210, 205], dim: [130, 50, 50], grid: [50, 10, 14],
        dock: [255, 60, 60], press: [255, 20, 20], badge: [94, 244, 248],
        stamina: [80, 220, 240], ram: [255, 60, 60], netinfo: [255, 60, 60],
        cpu: [255, 32, 32],
    },
    ARCTIC: {
        red: [225, 248, 255], cyan: [205, 240, 255], magenta: [235, 245, 255],
        green: [230, 250, 248], amber: [240, 248, 255], blue: [175, 210, 255],
        white: [255, 255, 255], dim: [150, 175, 200], grid: [40, 56, 84],
        dock: [255, 255, 255], press: [175, 225, 255], badge: [94, 244, 248],
        stamina: [80, 220, 240], ram: [255, 255, 255], netinfo: [255, 255, 255],
        cpu: [225, 248, 255],
    },
    SYNTHWAVE: {
        red: [255, 44, 130], cyan: [0, 240, 220], magenta: [255, 60, 220],
        green: [110, 255, 150], amber: [255, 210, 80], blue: [60, 80, 255],
        white: [244, 230, 255], dim: [110, 80, 140], grid: [58, 40, 84],
        dock: [0, 240, 220], press: [255, 44, 130], badge: [94, 244, 248],
        stamina: [80, 220, 240], ram: [0, 240, 220], netinfo: [0, 240, 220],
        cpu: [255, 44, 130],
    },
    JOHNNY: {
        red: [255, 208, 60], cyan: [255, 224, 110], magenta: [110, 160, 255],
        green: [255, 214, 90], amber: [255, 232, 130], blue: [60, 120, 255],
        white: [250, 246, 228], dim: [130, 116, 70], grid: [72, 62, 34],
        dock: [70, 110, 190], press: [255, 45, 60], badge: [94, 244, 248],
        stamina: [80, 220, 240], ram: [70, 110, 190], netinfo: [70, 110, 190],
        cpu: [255, 208, 60],
    },
    GHOST: {
        red: [0, 255, 120], cyan: [40, 255, 140], magenta: [40, 200, 120],
        green: [60, 255, 120], amber: [120, 255, 90], blue: [30, 120, 80],
        white: [200, 255, 220], dim: [40, 90, 60], grid: [10, 22, 16],
        dock: [40, 255, 140], press: [80, 255, 140], badge: [255, 60, 40],
        stamina: [40, 255, 140], ram: [40, 255, 140], netinfo: [40, 255, 140],
        cpu: [0, 255, 120],
    },
}

export const USER: Record<string, [number, number, number]> = {
    red: f(NEON.red), cyan: f(NEON.cyan), magenta: f(NEON.magenta),
    green: f(NEON.green), amber: f(NEON.amber), blue: f(NEON.blue),
    white: f(NEON.white), dim: f(NEON.dim), grid: f(NEON.grid),
    dock: f(NEON.dock), press: f(NEON.press), badge: f(NEON.badge),
    stamina: f(NEON.stamina), ram: f(NEON.ram), netinfo: f(NEON.netinfo), cpu: f(NEON.cpu),
}

const GLASS_ALPHA: Record<string, number> = { GHOST: 0.14, DARK: 0.85 }
export const glassAlpha = { value: 1 }
const updateGlassAlpha = (name: string) => { glassAlpha.value = GLASS_ALPHA[name] ?? 1 }

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
