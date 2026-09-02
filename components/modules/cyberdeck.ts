import Gdk from "gi://Gdk?version=3.0"

const MODKEYS = new Set([
    Gdk.KEY_Super_L, Gdk.KEY_Super_R, Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R, Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R, Gdk.KEY_ISO_Level3_Shift, Gdk.KEY_Caps_Lock,
])

export const isModKey = (kv: number): boolean => MODKEYS.has(kv)

export const modsFrom = (mask: number): string[] => {
    const m: string[] = []
    if (mask & Gdk.ModifierType.SUPER_MASK) m.push("SUPER")
    if (mask & Gdk.ModifierType.CONTROL_MASK) m.push("CTRL")
    if (mask & Gdk.ModifierType.MOD1_MASK) m.push("ALT")
    if (mask & Gdk.ModifierType.SHIFT_MASK) m.push("SHIFT")
    return m
}

export const keyName = (kv: number): string => {
    let n = ""
    try { n = Gdk.keyval_name(kv) || "" } catch { return "" }
    if (!n) return ""
    if (n.length === 1) return n.toUpperCase()
    if (n === "BackSpace") return "BackSpace"
    if (n === "Page_Up") return "PageUp"
    if (n === "Page_Down") return "PageDown"
    if (n.startsWith("KP_")) return n
    return n.toLowerCase()
}

export const comboFrom = (kv: number, mask: number): string => {
    const k = keyName(kv)
    if (!k || isModKey(kv)) return ""
    return [...modsFrom(mask), k].join(" + ")
}

export const modNameOf = (kv: number): string => {
    if (kv === Gdk.KEY_Super_L || kv === Gdk.KEY_Super_R || kv === Gdk.KEY_Meta_L || kv === Gdk.KEY_Meta_R) return "SUPER"
    if (kv === Gdk.KEY_Control_L || kv === Gdk.KEY_Control_R) return "CTRL"
    if (kv === Gdk.KEY_Alt_L || kv === Gdk.KEY_Alt_R) return "ALT"
    if (kv === Gdk.KEY_Shift_L || kv === Gdk.KEY_Shift_R) return "SHIFT"
    return ""
}

const MOD_ORDER = ["SUPER", "CTRL", "ALT", "SHIFT"]
export const orderMods = (set: string[]): string[] =>
    MOD_ORDER.filter((m) => set.includes(m))

export const canon = (combo: string): string => {
    const parts = String(combo).split("+").map((p) => p.trim().toUpperCase()).filter(Boolean)
    if (!parts.length) return ""
    const key = parts[parts.length - 1]
    const mods = parts.slice(0, -1).sort()
    return [...mods, key].join("+")
}
