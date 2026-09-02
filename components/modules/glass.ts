


import Gdk from "gi://Gdk?version=3.0"
import Pango from "gi://Pango?version=1.0"
import PangoCairo from "gi://PangoCairo?version=1.0"
import { USER, glassAlpha, neonBtn, onColorChange } from "./colors.ts"
import { makePlane, Plane } from "./proj.ts"

export const Cairo: any = (imports as any).cairo
import { TITLE, MONO, ICONF } from "./fonts.ts"
export { TITLE, MONO, ICONF }
export const CYAN: [number, number, number] = [...USER.dock] as [number, number, number]
const syncCyan = () => {
    const src = neonBtn.value ? USER.press : USER.dock
    CYAN[0] = src[0]; CYAN[1] = src[1]; CYAN[2] = src[2]
}
onColorChange(syncCyan)
syncCyan()
export const ACC: [number, number, number] = USER.glassacc
export const RED: [number, number, number] = USER.red
export const RACC: [number, number, number] = [1, 0.42, 0.46]
export const ch = (c: number) => String.fromCharCode(c)



export const makeModalPlane = (W: number, H: number): Plane =>
    makePlane({ w: W, h: H, yaw: 0, pitch: 0, roll: 0, focal: 1000, dist: 1000, pad: 30 })



export const HEADER = 36
export const panelPath = (ctx, x, y, w, h) => {
    const ny = Math.round(h * 0.42), ndep = 7, ncut = 9, brc = 26, tlc = 8
    const pts = [
        [x + tlc, y],
        [x + w, y],
        [x + w, y + ny],
        [x + w - ndep, y + ny + ncut],
        [x + w - ndep, y + h - brc],
        [x + w - ndep - brc, y + h],
        [x, y + h],
        [x, y + tlc],
    ]
    ctx.newPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath()
    return pts
}

export const drawGlass = (ctx, x, y, w, h, col: [number, number, number] = CYAN, a = 1) => {
    const [r, g, b] = col
    const ga = glassAlpha.value
    panelPath(ctx, x, y, w, h)
    const gb = new Cairo.LinearGradient(x, y, x + w * 0.5, y + h)
    gb.addColorStopRGBA(0, r * 0.14, g * 0.14 + 0.06, b * 0.18 + 0.02, 0.93 * a * ga)
    gb.addColorStopRGBA(0.5, r * 0.02 + 0.004, g * 0.04 + 0.02, b * 0.06 + 0.03, 0.9 * a * ga)
    gb.addColorStopRGBA(1, r * 0.04, g * 0.06 + 0.03, b * 0.1 + 0.03, 0.94 * a * ga)
    ctx.setSource(gb); ctx.fill()
    ctx.save(); panelPath(ctx, x, y, w, h); ctx.clip()
    const gs = new Cairo.LinearGradient(x, y, x + w * 0.65, y + h * 0.55)
    gs.addColorStopRGBA(0, 0.8, 0.97, 1, 0.13 * a * ga); gs.addColorStopRGBA(0.5, r, g, b, 0)
    ctx.setOperator(12); ctx.setSource(gs); ctx.rectangle(x, y, w, h); ctx.fill(); ctx.setOperator(2)
    ctx.restore()
    const lr = r + (1 - r) * 0.45, lg = g + (1 - g) * 0.45, lb = b + (1 - b) * 0.45
    panelPath(ctx, x, y, w, h); ctx.setSourceRGBA(lr, lg, lb, 0.92); ctx.setLineWidth(0.9); ctx.stroke()
}





let _txtfx = false
export const setTxtFX = (v) => { _txtfx = v }
export const txt = (ctx, x, y, s, font, size, col, a, bold = 0, glow = 0) => {
    ctx.selectFontFace(font, 0, bold); ctx.setFontSize(size)
    if (glow > 0) { ctx.setOperator(12); ctx.setSourceRGBA(col[0], col[1], col[2], glow * a); ctx.moveTo(x + 0.6, y); ctx.showText(s); ctx.setOperator(2) }
    if (_txtfx) {
        ctx.setOperator(12)
        ctx.setSourceRGBA(col[0], col[1], col[2], 0.3 * a); ctx.moveTo(x + 0.8, y + 0.6); ctx.showText(s)
        ctx.setSourceRGBA(1, 0.12, 0.16, 0.45 * a); ctx.moveTo(x - 1.5, y); ctx.showText(s)
        ctx.setSourceRGBA(1, 0.55, 0.3, 0.3 * a); ctx.moveTo(x + 1.5, y); ctx.showText(s)
        ctx.setOperator(2)
    }
    ctx.setSourceRGBA(col[0], col[1], col[2], a); ctx.moveTo(x, y); ctx.showText(s)
}
export const pango = (ctx, x, yBase, s, family, bold, px, col, a) => {
    try {
        const layout = PangoCairo.create_layout(ctx)
        const desc = Pango.FontDescription.new()
        desc.set_family(family); desc.set_weight(bold ? Pango.Weight.BOLD : Pango.Weight.NORMAL); desc.set_absolute_size(px * Pango.SCALE)
        layout.set_font_description(desc); layout.set_text(s, -1)
        const base = layout.get_baseline() / Pango.SCALE
        ctx.setSourceRGBA(col[0], col[1], col[2], a); ctx.moveTo(x, yBase - base); PangoCairo.show_layout(ctx, layout)
    } catch (e) { txt(ctx, x, yBase, s, family, px, col, a, bold ? 1 : 0, 0) }
}
const GLY = "ABCDEF0123456789#%&@/<>*=+|".split("")
export const scramble = (s, gl) => (gl > 0.03) ? s.split("").map((c) => (c === " " || Math.random() > gl * 0.92) ? c : GLY[(Math.random() * GLY.length) | 0]).join("") : s

export const pip = (px, py, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside } return inside }
export const projQuad = (plane: Plane, u0, v0, u1, v1) => [plane.project(u0, v0), plane.project(u1, v0), plane.project(u1, v1), plane.project(u0, v1)]


export const segParam = (plane: Plane, u0, v0, u1, v1, px, py) => {
    const L = plane.project(u0, v0), R = plane.project(u1, v1)
    const dx = R[0] - L[0], dy = R[1] - L[1], len2 = dx * dx + dy * dy || 1
    return Math.max(0, Math.min(1, ((px - L[0]) * dx + (py - L[1]) * dy) / len2))
}




export const warpReveal = (screenCtx, surf, plane: Plane, PW, PH, intro, seed, ss = 1) => {

    const e = intro, full = e >= 0.999
    const ease = full ? 1 : e * e * (3 - 2 * e)
    const dec = full ? 0 : 1 - ease
    const slideX = full ? 0 : -26 * dec
    const N = 400
    for (let i = 0; i < N; i++) {
        const v0 = i * PH / N, v1 = (i + 1) * PH / N
        const dx = slideX
        const tl = plane.project(0, v0), tr = plane.project(PW, v0), bl = plane.project(0, v1)
        const br = plane.project(PW, v1)
        const ulen0 = Math.hypot(tr[0] - tl[0], tr[1] - tl[1])
        const ulen1 = Math.hypot(br[0] - bl[0], br[1] - bl[1])
        const ulen = Math.max(ulen0, ulen1)
        const vlen = Math.hypot(bl[0] - tl[0], bl[1] - tl[1])
        const ang = Math.atan2(tr[1] - tl[1], tr[0] - tl[0])
        const sy = vlen / (v1 - v0)
        const bleed = 1.5 / Math.max(0.0001, sy)
        screenCtx.save()
        screenCtx.translate(tl[0] + dx, tl[1]); screenCtx.rotate(ang); screenCtx.scale(ulen / PW, sy)
        screenCtx.rectangle(0, -0.4, PW, (v1 - v0) + 0.4 + bleed); screenCtx.clip()
        if (ss !== 1) screenCtx.scale(1 / ss, 1 / ss)
        screenCtx.setSourceSurface(surf, 0, -v0 * ss); screenCtx.paint()
        screenCtx.restore()
    }
}

