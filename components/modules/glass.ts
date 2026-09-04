


import Gdk from "gi://Gdk?version=3.0"
import Pango from "gi://Pango?version=1.0"
import PangoCairo from "gi://PangoCairo?version=1.0"
import { USER, USER_A, isOvr, glassAlpha, neonBtn, onColorChange } from "./colors.ts"
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
export const RACC: [number, number, number] = USER.glassacc
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
    const ga = glassAlpha.value * USER_A.modalbg
    panelPath(ctx, x, y, w, h)
    const gb = new Cairo.LinearGradient(x, y, x + w * 0.5, y + h)
    if (isOvr("modalbg")) {
        const m = USER.modalbg
        gb.addColorStopRGBA(0, m[0], m[1], m[2], 0.93 * a * ga)
        gb.addColorStopRGBA(0.5, m[0] * 0.6, m[1] * 0.6, m[2] * 0.6, 0.9 * a * ga)
        gb.addColorStopRGBA(1, m[0] * 0.8, m[1] * 0.8, m[2] * 0.8, 0.94 * a * ga)
    } else {
        gb.addColorStopRGBA(0, r * 0.14, g * 0.14 + 0.06, b * 0.18 + 0.02, 0.93 * a * ga)
        gb.addColorStopRGBA(0.5, r * 0.02 + 0.004, g * 0.04 + 0.02, b * 0.06 + 0.03, 0.9 * a * ga)
        gb.addColorStopRGBA(1, r * 0.04, g * 0.06 + 0.03, b * 0.1 + 0.03, 0.94 * a * ga)
    }
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




const REVEAL_BANDS = 9
const REVEAL_SLICES = 72
const REST_SLICES = 240
const fitCache = new WeakMap<Plane, any>()
const planeFit = (plane: Plane, PW, PH) => {
    const hit = fitCache.get(plane)
    if (hit && hit.PW === PW && hit.PH === PH) return hit
    const o = plane.project(0, 0), e = plane.project(PW, PH)
    const fx = (e[0] - o[0]) / PW, fy = (e[1] - o[1]) / PH
    let dev = 0
    const probes = [[PW, 0], [0, PH], [PW * 0.5, PH * 0.5], [PW * 0.25, PH * 0.75], [PW * 0.75, PH * 0.25]]
    for (const [u, v] of probes) {
        const p = plane.project(u, v)
        dev = Math.max(dev, Math.abs(p[0] - (o[0] + u * fx)), Math.abs(p[1] - (o[1] + v * fy)))
    }
    const rec = { PW, PH, ox: o[0], oy: o[1], fx, fy, affine: dev < 0.01 }
    fitCache.set(plane, rec)
    return rec
}
const revealState = (intro, seed, PH) => {
    const e = intro, full = e >= 0.999
    const ease = full ? 1 : e * e * (3 - 2 * e)
    const dec = full ? 0 : 1 - ease
    const slideX = full ? 0 : -26 * dec
    const s = Math.floor(seed * 55)
    const nz = (k) => { const x = Math.sin(s * 12.9 + k * 78.2) * 43758.5; return x - Math.floor(x) }
    const shiftAt = (v) => full ? 0 : (nz(Math.floor(v / (PH / REVEAL_BANDS)) + 1) * 2 - 1) * 50 * dec * dec
    return { full, dec, slideX, shiftAt }
}
const revealSlice = (plane: Plane, PW, PH, state, i, N) => {
    const v0 = i * PH / N, v1 = (i + 1) * PH / N
    const tl = plane.project(0, v0), tr = plane.project(PW, v0), bl = plane.project(0, v1), br = plane.project(PW, v1)
    const ulen = Math.max(Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), Math.hypot(br[0] - bl[0], br[1] - bl[1]))
    const vlen = Math.hypot(bl[0] - tl[0], bl[1] - tl[1])
    const angle = Math.atan2(tr[1] - tl[1], tr[0] - tl[0])
    const sy = vlen / (v1 - v0)
    return {
        v0, v1,
        x: tl[0] + state.slideX + state.shiftAt(v0), y: tl[1],
        angle, cos: Math.cos(angle), sin: Math.sin(angle),
        sx: ulen / PW, sy, bleed: 1.5 / Math.max(0.0001, sy),
    }
}
const REST_STATE = { full: true, dec: 0, slideX: 0, shiftAt: (_v: number) => 0 }
const restCache = new WeakMap<Plane, any>()
const restSlices = (plane: Plane, PW, PH) => {
    const hit = restCache.get(plane)
    if (hit && hit.PW === PW && hit.PH === PH) return hit.arr
    const arr: any[] = []
    for (let i = 0; i < REST_SLICES; i++) arr.push(revealSlice(plane, PW, PH, REST_STATE, i, REST_SLICES))
    restCache.set(plane, { PW, PH, arr })
    return arr
}
const paintSlice = (screenCtx, surf, b, PW, ss) => {
    screenCtx.save()
    screenCtx.translate(b.x, b.y); screenCtx.rotate(b.angle); screenCtx.scale(b.sx, b.sy)
    screenCtx.rectangle(0, -0.4, PW, (b.v1 - b.v0) + 0.4 + b.bleed); screenCtx.clip()
    if (ss !== 1) screenCtx.scale(1 / ss, 1 / ss)
    screenCtx.setSourceSurface(surf, 0, -b.v0 * ss); screenCtx.paint()
    screenCtx.restore()
}
const hitSlice = (b, px, py, PW, PH): [number, number] | null => {
    const dx = px - b.x, dy = py - b.y
    const u = (dx * b.cos + dy * b.sin) / b.sx
    const lv = (-dx * b.sin + dy * b.cos) / b.sy
    if (u >= 0 && u <= PW && lv >= -0.4 && lv <= b.v1 - b.v0 + 0.4 + b.bleed)
        return [u, Math.max(0, Math.min(PH, b.v0 + lv))]
    return null
}

export const unwarpRevealPoint = (px, py, plane: Plane, PW, PH, intro, seed): [number, number] | null => {
    const state = revealState(intro, seed, PH)
    if (state.full) {
        const fit = planeFit(plane, PW, PH)
        if (fit.affine) {
            const u = (px - fit.ox) / fit.fx, v = (py - fit.oy) / fit.fy
            if (u < 0 || u > PW || v < -0.4 || v > PH + 1.9) return null
            return [u, Math.max(0, Math.min(PH, v))]
        }
        const arr = restSlices(plane, PW, PH)
        for (let i = arr.length - 1; i >= 0; i--) {
            const h = hitSlice(arr[i], px, py, PW, PH)
            if (h) return h
        }
        return null
    }
    for (let i = REVEAL_SLICES - 1; i >= 0; i--) {
        const h = hitSlice(revealSlice(plane, PW, PH, state, i, REVEAL_SLICES), px, py, PW, PH)
        if (h) return h
    }
    return null
}

export const warpReveal = (screenCtx, surf, plane: Plane, PW, PH, intro, seed, ss = 1) => {
    const state = revealState(intro, seed, PH)
    if (state.full) {
        const fit = planeFit(plane, PW, PH)
        if (fit.affine) {
            screenCtx.save()
            screenCtx.translate(fit.ox, fit.oy); screenCtx.scale(fit.fx / ss, fit.fy / ss)
            screenCtx.setSourceSurface(surf, 0, 0); screenCtx.paint()
            screenCtx.restore()
            return
        }
        const arr = restSlices(plane, PW, PH)
        for (let i = 0; i < arr.length; i++) paintSlice(screenCtx, surf, arr[i], PW, ss)
        return
    }
    for (let i = 0; i < REVEAL_SLICES; i++) paintSlice(screenCtx, surf, revealSlice(plane, PW, PH, state, i, REVEAL_SLICES), PW, ss)
    const { dec, slideX } = state
    screenCtx.setOperator(12); screenCtx.setLineJoin(0)
    for (let b = 1; b < REVEAL_BANDS; b++) {
        const v = b * PH / REVEAL_BANDS, off = 3 + dec * 6, a = dec * 0.6
        const l = plane.project(14, v), rp = plane.project(PW - 14, v)
        screenCtx.setLineWidth(1.6)
        screenCtx.setSourceRGBA(RED[0], RED[1], RED[2], a); screenCtx.newPath(); screenCtx.moveTo(l[0] - off, l[1]); screenCtx.lineTo(rp[0] - off, rp[1]); screenCtx.stroke()
        screenCtx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], a); screenCtx.newPath(); screenCtx.moveTo(l[0] + off, l[1]); screenCtx.lineTo(rp[0] + off, rp[1]); screenCtx.stroke()
    }
    const a0 = plane.project(14, 0), a1 = plane.project(14, PH)
    const er = CYAN[0] + (1 - CYAN[0]) * 0.75, eg = CYAN[1] + (1 - CYAN[1]) * 0.75, eb = CYAN[2] + (1 - CYAN[2]) * 0.75
    screenCtx.setSourceRGBA(er, eg, eb, dec * 0.85); screenCtx.setLineWidth(2.4)
    screenCtx.newPath(); screenCtx.moveTo(a0[0] + slideX, a0[1]); screenCtx.lineTo(a1[0] + slideX, a1[1]); screenCtx.stroke()
    screenCtx.setOperator(2)
}
