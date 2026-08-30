








import { Box, DrawingArea, EventBox } from "./widget.ts"
import { interval, Variable } from "astal"
import { buildStats } from "./sys.ts"
import { makePlane, fillQuad, tiltText } from "./proj.ts"
import { RGB, f, NEON, onColorChange } from "./colors.ts"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"

import { TITLE, MONO, ICONF } from "./fonts.ts"
const stats = buildStats()
const get = (k: string) => stats.find(s => s.key === k)
const cpu = get("cpu")!, ram = get("ram")!


const GRAY: RGB = [200, 200, 200] as any
const LIGHTRED: RGB = NEON.cpu
const CYAN: RGB = NEON.badge
const RAMCOL: RGB = NEON.ram
const BADGECOL: RGB = NEON.badge
const STOCOL: RGB = NEON.badge

const batColor = (p: number): RGB => p < 10 ? [255, 55, 55] as any : p < 50 ? [255, 120, 45] as any : p < 70 ? [255, 205, 55] as any : NEON.stamina

const read = (p: string) => { try { const [ok, d] = GLib.file_get_contents(p); return ok ? new TextDecoder().decode(d) : "" } catch { return "" } }


const batDir = ((): string | null => {
    try { const d = GLib.Dir.open("/sys/class/power_supply", 0); let n: string | null
        while ((n = d.read_name())) { const p = `/sys/class/power_supply/${n}`; if (read(`${p}/type`).trim() === "Battery") return p } } catch {}
    return null
})()
const readBat = () => batDir ? (parseInt(read(`${batDir}/capacity`).trim()) || 0) / 100 : 1
const HAS_BAT = batDir !== null
const YELB: RGB = [255, 214, 31] as any
let batStatus = ""
const readBatStatus = () => { batStatus = batDir ? read(`${batDir}/status`).trim() : "" }
const isCharging = () => batStatus === "Charging"
readBatStatus()

let diskFrac = 0, diskUsedG = 0, diskTotG = 0
const readDisk = () => { try {
    const i = Gio.File.new_for_path("/").query_filesystem_info("filesystem::size,filesystem::used", null)
    const sz = Number(i.get_attribute_uint64("filesystem::size")), us = Number(i.get_attribute_uint64("filesystem::used"))
    diskTotG = Math.round(sz / 1e9); diskUsedG = Math.round(us / 1e9); diskFrac = sz > 0 ? us / sz : 0
} catch {} }
readDisk(); let batteryV = readBat()
const poke = Variable(0)
interval(8000, () => { readDisk(); batteryV = readBat(); readBatStatus(); poke.set(poke.get() + 1) })

let badgeVal = "1"
export const setWorkspaceBadge = (v: any) => {
    const s = String(v ?? "").trim()
    if (!s || s === badgeVal) return
    badgeVal = s
    poke.set(poke.get() + 1)
}

const W = 500, H = 96
const X0 = 62, MAIN = W - 78, RAMX = X0 + (MAIN - X0) * 0.42, BATX = W - 46
const plane = makePlane({ w: W, h: H, yaw: -24, pitch: -6, roll: 1.6, focal: 2100, dist: 2200, pad: 2 })
const clamp = (n: number) => Math.max(0, Math.min(1, n))

const poly = (ctx: any, pts: [number, number][], col: RGB, a: number, fill = true, lw = 2) => {
    const [r, g, b] = f(col)
    ctx.newPath(); pts.map(([u, v]) => plane.project(u, v)).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
    ctx.setSourceRGBA(r, g, b, a); if (fill) ctx.fill(); else { ctx.setLineWidth(lw); ctx.stroke() }
}
const glowPath = (ctx: any, pts: [number, number][], col: RGB, blur: number, k: number) => {
    const [r, g, b] = f(col)
    const trace = () => { ctx.newPath(); pts.map(([u, v]) => plane.project(u, v)).forEach(([x, y]: [number, number], i: number) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath() }
    ctx.setOperator(12)
    for (const [w, a] of [[blur * 1.5, 0.10], [blur * 0.8, 0.17]] as const) {
        trace(); ctx.setSourceRGBA(r, g, b, a * k); ctx.setLineWidth(w); ctx.stroke()
    }
    ctx.setOperator(2)
    ctx.save(); trace(); ctx.clip(); ctx.setOperator(12)
    for (const [w, a] of [[blur * 1.8, 0.13], [blur * 1.0, 0.20], [blur * 0.5, 0.32]] as const) {
        trace(); ctx.setSourceRGBA(r, g, b, a * k); ctx.setLineWidth(w); ctx.stroke()
    }
    ctx.setOperator(2); ctx.restore()
}
const bloom = (ctx: any, x0: number, y0: number, x1: number, y1: number, col: RGB, blur: number, k: number) =>
    glowPath(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], col, blur, k)
const glowShape = (ctx: any, pts: [number, number][], col: RGB, blur: number, k: number) => glowPath(ctx, pts, col, blur, k)

const holoFill = (ctx: any, x0: number, x1: number, y: number, h: number, base: RGB, a: number) => {
    fillQuad(ctx, plane, x0, y, x1, y + h, base, a)
}

const scanlines = (ctx: any, x0: number, x1: number, y: number, h: number, gap: number) => {
    for (let sy = y + gap * 0.6; sy < y + h - 0.3; sy += gap)
        fillQuad(ctx, plane, x0, sy, x1, sy + 0.5, [255, 255, 255] as any, 0.06)
}

export const Monitors = () => {
    const area = DrawingArea({}); area.set_size_request(plane.width, plane.height)
    onColorChange(() => area.queue_draw())
    const d = { sto: 0, cpu: 0, ram: 0, bat: 0 }

    let mx = -1, my = -1, hovered: string | null = null
    const hitTest = (x: number, y: number): string | null => {
        const [sto_l, sto_t] = plane.project(X0, 15)
        const [sto_r] = plane.project(MAIN, 15)
        const [cpu_l, cpu_t] = plane.project(X0, 22)
        const [cpu_r] = plane.project(MAIN, 22)
        const [ram_l, ram_t] = plane.project(X0, 44)
        const [ram_r] = plane.project(RAMX, 44)
        const [bat_l, bat_t] = plane.project(22, 78)
        const [bat_r, bat_b] = plane.project(BATX, 90)
        const [bx_l, bx_t] = plane.project(18, 14)
        const [bx_r, bx_b] = plane.project(62, 54)


        const mid1 = (sto_t + cpu_t) / 2
        const mid2 = (cpu_t + ram_t) / 2
        const mid3 = (ram_t + bat_t) / 2


        if (x >= bx_l - 4 && x <= bx_r + 4 && y >= bx_t - 4 && y <= bx_b + 4) return "badge"
        if (y >= bat_t - 6 && y <= bat_b + 6 && x >= bat_l - 6 && x <= bat_r + 6) return "bat"
        if (y >= mid1 && y < mid2 && x >= sto_l - 6 && x <= sto_r + 6) return "sto"
        if (y >= mid2 && y < mid3 && x >= cpu_l - 6 && x <= cpu_r + 6) return "cpu"
        if (y >= mid3 && y < bat_t + 10 && x >= ram_l - 6 && x <= ram_r + 6) return "ram"
        return null
    }
    const tooltipLabels: Record<string, string> = {
        bat: "BATTERY LEVEL",
        sto: "STORAGE INFO",
        cpu: "CPU USAGE",
        ram: "RAM USAGE",
        badge: "ACTIVE WORKSPACE",
    }

    const evt = EventBox({ child: area })
    try { evt.add_events(Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK) } catch {}
    evt.connect("motion-notify-event", (_w: any, e: any) => {
        let x = 0, y = 0
        try { const c = e.get_coords?.(); if (c) { x = c[1]; y = c[2] } } catch {}
        mx = x; my = y
        const prev = hovered
        hovered = hitTest(x, y)
        if (hovered !== prev) area.queue_draw()
        return false
    })
    evt.connect("leave-notify-event", () => {
        mx = -1; my = -1; hovered = null; area.queue_draw(); return false
    })
    area.connect("draw", (_w: any, ctx: any) => {
        const bcol = batColor(batteryV * 100)
        const bx = 18, by = 14, S = 40
        const P = (px: number, py: number): [number, number] => [bx + px / 45 * S, by + py / 45 * S]
        const badge: [number, number][] = [P(1, 1), P(44, 1), P(44, 44), P(14.6, 44), P(1, 27.4)]
        poly(ctx, badge, [4, 15, 19] as any, 0.55)
        glowShape(ctx, badge, BADGECOL, 3, 0.8)
        poly(ctx, badge, BADGECOL, 0.96, false, 1.4)
        const num = badgeVal.replace("°", ""), nw = num.length * 11
        tiltText(ctx, plane, bx + 20, by + 24, num, TITLE, 15, BADGECOL, 0.95, { align: "c", bold: true, glow: 0.8 })

        {
            const y = 15, h = 4, end = X0 + (MAIN - X0) * clamp(d.sto)
            fillQuad(ctx, plane, X0, y, MAIN, y + h, GRAY, 0.10)
            bloom(ctx, X0, y, end, y + h, STOCOL, 7, 1.2)
            holoFill(ctx, X0, end, y, h, STOCOL, 0.9)
        }
        {
            const y = 22, h = 18, ch = (MAIN - X0) * 0.05
            poly(ctx, [[X0, y], [MAIN, y], [MAIN, y + h * 0.5], [MAIN - ch, y + h], [X0, y + h]], NEON.darkred, 0.42)
            const end = X0 + (MAIN - X0) * clamp(d.cpu)
            const fillPts: [number, number][] = end <= MAIN - ch
                ? [[X0, y], [end, y], [end, y + h], [X0, y + h]]
                : [[X0, y], [end, y], [end, y + h / 2 + (h / 2) * (MAIN - end) / ch], [MAIN - ch, y + h], [X0, y + h]]
            glowShape(ctx, fillPts, LIGHTRED, 8, 1.1)
            poly(ctx, fillPts, LIGHTRED, 0.85)
            scanlines(ctx, X0, end, y, h, 2.8)
        }
        {
            const y = 44, h = 18, tw = 8, gap = 1.6
            const n = Math.max(1, Math.floor((RAMX - X0 + gap) / (tw + gap)))
            const lit = Math.round(clamp(d.ram) * n)
            const RAMP: [number, number][] = [[11.29, 0], [18, 0], [18, 52.09], [11.29, 60], [4.58, 60], [4.58, 30], [0, 30], [0, 0]]
            for (let i = 0; i < n; i++) {
                const sx = X0 + i * (tw + gap)
                const pts = RAMP.map(([px, py]) => [sx + px / 18 * tw, y + py / 60 * h]) as [number, number][]
                if (i < lit) { glowShape(ctx, pts, RAMCOL, 2.8, 1.0); poly(ctx, pts, RAMCOL, 0.9) }
                else poly(ctx, pts, RAMCOL, 0.14)
            }
        }
        {
            const bat0 = 22, y = 78, h = 7, bv = 3
            const end = bat0 + (BATX - bat0) * clamp(d.bat)
            const barShape: [number, number][] = [[bat0, y], [BATX, y], [BATX + bv, y + h], [bat0 + bv, y + h]]
            const fillPts: [number, number][] = end <= bat0 + bv
                ? [[bat0, y], [end, y], [end + bv, y + h], [bat0 + bv, y + h]]
                : [[bat0, y], [end, y], [end + bv * (end - bat0) / (BATX - bat0), y + h], [bat0 + bv, y + h]]
            poly(ctx, barShape, darken(bcol, 0.6), 0.25)
            glowShape(ctx, fillPts, bcol, 5, 0.8)
            poly(ctx, fillPts, bcol, 0.88)
            scanlines(ctx, bat0, end, y, h, 2.2)
            poly(ctx, barShape, bcol, 0.96, false, 1.2)
                    }

        tiltText(ctx, plane, W, 11, `${diskUsedG}/${diskTotG}G`, MONO, 8, STOCOL, 0.85, { align: "r", bold: true })
        tiltText(ctx, plane, W, 46, cpu.percent.get(), TITLE, 24, LIGHTRED, 1, { align: "r", bold: true, glow: 0.42 })
        const ramUsed = ram.substat.get().replace(/\s*GB/i, ""), ramTot = ram.sublabel.replace(/\s*GB/i, "")
        tiltText(ctx, plane, W - 216, 59, `${ramUsed} / ${ramTot} GB`, MONO, 10.5, RAMCOL, 0.95, { align: "r", bold: true, glow: 0.3 })
        const charging = isCharging()
        tiltText(ctx, plane, 6, 84, "\uf0e7", ICONF, 10, charging ? YELB : bcol, 0.95)
        if (charging) {
            const ph = Date.now() / 520
            for (let i = 0; i < 3; i++) {
                const t = (ph + i / 3) % 1
                const yy = 92 - t * 17
                const a = 0.72 * Math.sin(Math.PI * t)
                fillQuad(ctx, plane, 3.4, yy, 8.6, yy + 1.7, YELB, a)
                fillQuad(ctx, plane, 6.2, yy - 2.1, 10.4, yy - 0.6, YELB, a * 0.5)
            }
        }
        if (HAS_BAT) tiltText(ctx, plane, W, 85, `${Math.round(batteryV * 100)}%`, TITLE, 10, charging ? YELB : bcol, 0.92, { align: "r", bold: true })
        else tiltText(ctx, plane, W, 85, "Power connected", TITLE, 9, bcol, 0.92, { align: "r", bold: true })

        if (hovered && mx >= 0) {
            const label = tooltipLabels[hovered]
            if (label) {
                const fs = 9, pad = 8, notch = 7
                ctx.save()
                ctx.selectFontFace(TITLE, 0, 1)
                ctx.setFontSize(fs)
                const te = ctx.textExtents(label)
                const tw = te.width + pad * 2, th = te.height + pad * 2 + 2
                let tx = mx + 14, ty = my - th - 6
                if (tx + tw > plane.width) tx = mx - tw - 10
                if (ty < 0) ty = my + 20

                const shape: [number, number][] = [
                    [tx + notch, ty],
                    [tx + tw, ty],
                    [tx + tw, ty + th - notch],
                    [tx + tw - notch, ty + th],
                    [tx, ty + th],
                    [tx, ty + notch],
                ]

                const [tr, tg, tb] = f(NEON.red)
                const [dr, dg, db] = f(darken(NEON.red, 0.95))
                const [lr, lg, lb] = f(lighten(NEON.red, 0.6))

                ctx.newPath()
                shape.forEach(([sx, sy], i) => i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy))
                ctx.closePath()
                ctx.setSourceRGBA(dr, dg, db, 0.92)
                ctx.fill()

                ctx.newPath()
                shape.forEach(([sx, sy], i) => i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy))
                ctx.closePath()
                ctx.setSourceRGBA(tr, tg, tb, 0.08)
                ctx.fill()

                for (let sy = ty + 2; sy < ty + th - 2; sy += 2.5) {
                    ctx.newPath(); ctx.moveTo(tx + 2, sy); ctx.lineTo(tx + tw - 2, sy)
                    ctx.setSourceRGBA(tr, tg, tb, 0.04)
                    ctx.setLineWidth(0.5); ctx.stroke()
                }


                ctx.setOperator(12)
                for (const [w, a] of [[6, 0.06], [4, 0.10], [2.5, 0.16]] as const) {
                    ctx.newPath()
                    shape.forEach(([sx, sy], i) => i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy))
                    ctx.closePath()
                    ctx.setSourceRGBA(tr, tg, tb, a)
                    ctx.setLineWidth(w)
                    ctx.stroke()
                }
                ctx.setOperator(2)


                ctx.newPath()
                shape.forEach(([sx, sy], i) => i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy))
                ctx.closePath()
                ctx.setSourceRGBA(tr, tg, tb, 0.95)
                ctx.setLineWidth(1.3)
                ctx.stroke()


                ctx.setSourceRGBA(lr, lg, lb, 1)
                ctx.setLineWidth(1.5)
                ctx.newPath(); ctx.moveTo(tx, ty + notch); ctx.lineTo(tx + notch, ty); ctx.stroke()
                ctx.newPath(); ctx.moveTo(tx + tw - notch, ty + th); ctx.lineTo(tx + tw, ty + th - notch); ctx.stroke()


                const baseline = ty + pad + te.height + (te.y < 0 ? te.y : 0)
                ctx.setSourceRGBA(lr, lg, lb, 1)
                ctx.moveTo(tx + pad, baseline)
                ctx.showText(label)
                ctx.restore()
            }
        }

        return false
    })
    const tgt = () => ({ sto: diskFrac, cpu: clamp(cpu.frac.get()), ram: clamp(ram.frac.get()), bat: batteryV })
    let last = "", lastDraw = 0, t: any = null
    const pump = () => {
        let busy = false, changed = false
        const g = tgt()
        for (const k of ["sto", "cpu", "ram", "bat"] as const) {
            const di = g[k] - (d as any)[k]
            if (Math.abs(di) > 0.04) { (d as any)[k] += di * 0.22; busy = true }
            else if (di !== 0) (d as any)[k] = g[k]
        }
        const sig = `${cpu.percent.get()}|${ram.substat.get()}|${diskUsedG}|${Math.round(batteryV * 100)}|${badgeVal}|${batStatus}`
        if (sig !== last) { last = sig; changed = true }
        const now = Date.now()
        if (busy || (changed && now - lastDraw > 320)) { lastDraw = now; area.queue_draw() }
        if (busy && !t) t = interval(110, pump)
        else if (!busy && t) { t.cancel(); t = null }
    }
    cpu.frac.subscribe(pump); ram.frac.subscribe(pump); poke.subscribe(pump)
    let chargeT: any = null
    const chargePump = interval(1000, () => {
        if (isCharging()) { if (!chargeT) chargeT = interval(90, () => area.queue_draw()) }
        else if (chargeT) { chargeT.cancel(); chargeT = null }
    })
    area.connect("destroy", () => { if (t) t.cancel(); if (chargeT) chargeT.cancel(); chargePump.cancel() })
    return Box({ className: "monitors", children: [evt] })
}
const lighten = (c: RGB, t: number): RGB => [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t] as any
const darken = (c: RGB, t: number): RGB => [c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t)] as any
