export const TITLE = "Quantico"
export const MONO = "Tektur"
export const ICONF = "Symbols Nerd Font"
export const isIconGlyph = (text: string): boolean => {
    const points = Array.from(text, char => char.codePointAt(0)!)
    return points.length > 0 && points.every(code =>
        (code >= 0xe000 && code <= 0xf8ff)
        || (code >= 0xf0000 && code <= 0xffffd)
        || (code >= 0x100000 && code <= 0x10fffd)
    )
}
export const NAVINE = "Navine"
export const NEUE = "TT Supermolot Neue Trl"
export const ORBITRON = "Orbitron"
export const ROBOTO_LIGHT = "Roboto Light"
export const ROBOTO_BOLD = "Roboto Bold"
export const ROBOTO = "Roboto"
export const RAJDHANI = "Rajdhani"
export const RAJDHANI_MED = "Rajdhani Medium"
export const PLAY = "Play"
export const ENIXE = "Enixe"
export const FROSTBITE_WIDE = "FROSTBITE Wide"
export const GUNSHIP_ITAL = "Gunship Italic"
