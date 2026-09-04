import { Box, DrawingArea, EventBox } from "./widget.ts"
import Gdk from "gi://Gdk?version=3.0"
import { interval, timeout, execAsync } from "astal"
import AstalNotifd from "gi://AstalNotifd"
import { toggleModal, isModalOpen, onModalChange } from "./cmodal.ts"
import { toggleNotifHud, isNotifHudOpen, onNotifHudChange, notifCount } from "./notifmessages.ts"
import { togglePlayer, isPlayerOpen, onPlayerChange, playPauseActive } from "./player.ts"
import { makePlane, strokePath, tiltText, tiltImage, fillQuad } from "./proj.ts"
import { NEON, f, RGB, onColorChange, imgTint, neonBtn, notifBubble } from "./colors.ts"
const NOTIF_RED: RGB = NEON.notifbadge
import { CYBER_DIR } from "../../env.ts"

const Cairo: any = (imports as any).cairo
let _phoneIcon: any = null
const phoneIcon = () => { if (!_phoneIcon) try { _phoneIcon = Cairo.ImageSurface.createFromPNG(`${CYBER_DIR}/assets/icons/phone.png`) } catch { _phoneIcon = null } return _phoneIcon }

const sh = (c) => execAsync(["sh", "-c", c]).catch(() => "")
const shBool = (c) => sh(c).then(o => /\b(on|yes|true|1|enabled|RUNNING)\b/i.test(o.trim()))
import { TITLE, ICONF } from "./fonts.ts"

const VERT_TILES = [
 { key: "vol", icon: "", label: "", sc: "V", state: () => sh("wpctl get-volume @DEFAULT_AUDIO_SINK@").then(o => !/MUTED/.test(o)) },
 { key: "brt", icon: "", label: "", sc: "I", state: () => Promise.resolve(true) },
 { key: "notification", icon: "", label: "", sc: "M", state: () => Promise.resolve(isNotifHudOpen()) },
 { key: "music", icon: "", label: "", sc: "O", eq: true, state: () => sh("playerctl -a status 2>/dev/null").then(o => /playing/i.test(o)) },
]
const HORIZ_TILES = [
 { key: "rec", icon: "", label: "", sc: "R", state: () => shBool("[ -f /tmp/hypr-record.pid ] && echo 1 || echo 0") },
 { key: "wifi", icon: "", label: "", sc: "N", state: () => shBool("nmcli radio wifi") },
 { key: "bt", icon: "", label: "", sc: "B", state: () => shBool("bluetoothctl show | grep Powered") },
 { key: "pwr", icon: "", label: "", sc: "P" },
]

const VSW = 44, VSH = 42, VG = 6
const HSW = 50, HSH = 48, HG = 8
const BADGE = 19, BGAP = 5

const VPLANE_W = BADGE + BGAP + VSW
const VPLANE_H = 4 * VSH + 3 * VG - 15
const vsp = makePlane({ w: VPLANE_W, h: VPLANE_H, yaw: -30, pitch: 12, roll: 1, focal: 1050, dist: 1050, pad: 20 })

const HPLANE_W = 4 * HSW + 3 * HG
const HPLANE_H = HSH + BGAP + BADGE -15
const hsp = makePlane({ w: HPLANE_W, h: HPLANE_H, yaw: -15, pitch: 20, roll: 3.2, focal: 1050, dist: 1050, pad: 20 })

const VLAYOUT: { k: string; x: number; y: number; w: number; h: number }[] = [
 { k: "vol", x: BADGE + BGAP, y: 0, w: VSW, h: VSH },
 { k: "brt", x: BADGE + BGAP, y: VSH + VG, w: VSW, h: VSH },
 { k: "notification", x: BADGE + BGAP, y: 2 * (VSH + VG), w: VSW, h: VSH },
 { k: "music", x: BADGE + BGAP, y: 3 * (VSH + VG), w: VSW, h: VSH },
]

const HLAYOUT: { k: string; x: number; y: number; w: number; h: number }[] = [
 { k: "rec", x: 0, y: 0, w: HSW, h: HSH },
 { k: "wifi", x: HSW + HG, y: 0, w: HSW, h: HSH },
 { k: "bt", x: 2 * (HSW + HG), y: 0, w: HSW, h: HSH },
 { k: "pwr", x: 3 * (HSW + HG), y: 0, w: HSW, h: HSH },
]

const tileOf = (k: string) => [...VERT_TILES, ...HORIZ_TILES].find(t => t.key === k)!

const eqBars = [0.3, 0.5, 0.4, 0.6, 0.45]
let musicPlaying = false
const drawEq = (ctx, plane, s, edge, alpha) => {
 const n = eqBars.length, cw = s.w * 0.46, x0 = s.x + s.w / 2 - cw / 2
 const baseY = s.y + s.h * 0.66, maxH = s.h * 0.40, slot = cw / n, bw = slot * 0.6
 for (let i = 0; i < n; i++) {
     const bh = (0.16 + eqBars[i] * 0.84) * maxH
     fillQuad(ctx, plane, x0 + i * slot, baseY - bh, x0 + i * slot + bw, baseY, edge, alpha)
 }
}
const drawBadgeBox = (ctx, plane, bx, by, bsz, sc, edge, labelCol = edge) => {
 if (!sc) return
 const p00 = plane.project(bx, by), p10 = plane.project(bx + bsz, by)
 const p11 = plane.project(bx + bsz, by + bsz), p01 = plane.project(bx, by + bsz)
 const [r, g, b] = f(edge)
 const [lr, lg, lb] = f(labelCol)
 const quad = () => { ctx.newPath(); ctx.moveTo(p00[0], p00[1]); ctx.lineTo(p10[0], p10[1]); ctx.lineTo(p11[0], p11[1]); ctx.lineTo(p01[0], p01[1]); ctx.closePath() }
 quad(); ctx.setSourceRGBA(0.008, 0.043, 0.06, 0.92); ctx.fill()
 quad(); ctx.setSourceRGBA(r, g, b, 0.85); ctx.setLineWidth(1.2); ctx.stroke()
 const ccx = (p00[0] + p10[0] + p11[0] + p01[0]) / 4, ccy = (p00[1] + p10[1] + p11[1] + p01[1]) / 4
 const ang = Math.atan2(p10[1] - p00[1], p10[0] - p00[0])
 const psc = Math.hypot(p10[0] - p00[0], p10[1] - p00[1]) / bsz
 ctx.save(); ctx.translate(ccx, ccy); ctx.rotate(ang*0.38); ctx.scale(psc, psc)
 ctx.selectFontFace(TITLE, 0, 1); ctx.setFontSize(bsz * 0.58)
 const tw = ctx.textExtents(sc).width
 ctx.setSourceRGBA(lr, lg, lb, 0.97); ctx.moveTo(-tw / 2, bsz * 0.2); ctx.showText(sc)
 ctx.restore()
}

const vertSlotFrame = (x: number, y: number, w: number, h: number): [number, number][] => {
 const step = Math.max(5, h * 0.05)
 const jog = Math.max(5, w * 0.35)
 const cutTR = Math.max(3, Math.min(w, h) * 0)
 const cutBR = Math.max(4, Math.min(w, h) * 0.14)
 const cutBL = Math.max(2, Math.min(w, h) * 0.08)
 return [
 [x + 1 + jog + 4, y + 1],
 [x + 1 + jog, y + 1 + step * 0.5],
 [x + 1, y - 1 + step],
 [x + 1, y + h - 1 - cutBL],
 [x + 1 + cutBL, y + h - 1],
 [x + w - 1 - cutBR, y + h - 1],
 [x + w - 1, y + h - 1 - cutBR],
 [x + w - 1, y + 1 + cutTR],
 [x + w - 1 - cutTR, y + 1],
 [x + 1 + jog + 4, y + 1],
 ]
}

const horizSlotFrame = (x: number, y: number, w: number, h: number): [number, number][] => {
    const nx = Math.max(6, w * 0.32)
    const nw = Math.max(14, w * 0.40)
    const nd = Math.max(1, h * 0.02)
    const dw = nw * 0.10
    const chamferH = Math.max(2, h * 0.05)
    const chamferW = Math.max(3, h * 0.08)
    const vertAfter = Math.max(6, h * 0.20)
    const cutBL = Math.max(2, Math.min(w, h) * 0.10)
    return [
        [x + 1, y + 1],
        [x + 1 + nx, y + 1],
        [x + 1 + nx + dw, y + 1 + nd],
        [x + 1 + nx + nw - dw, y + 1 + nd],
        [x + 1 + nx + nw, y + 1],
        [x + w - 1, y + 1],
        [x + w - 1, y + h - 1 - chamferH - vertAfter],
        [x + w - 1 - chamferW, y + h - 1 - vertAfter],
        [x + w - 1 - chamferW, y + h - 1],
        [x + 1 + cutBL, y + h - 1],
        [x + 1, y + h - 1 - cutBL],
        [x + 1, y + 1],
    ]}
const pip = (px: number, py: number, poly: [number, number][]) => {
 let inside = false
 for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
 const [xi, yi] = poly[i], [xj, yj] = poly[j]
 if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside
 }
 return inside
}
let _dockArea: any = null
const _notifd = AstalNotifd.get_default()
try { _notifd.connect("notified", () => { if (_dockArea) _dockArea.queue_draw() }) } catch {}
export const dockNotifDecr = () => { if (_dockArea) _dockArea.queue_draw() }
const hoverers: any[] = []
const hoverBus: any = { key: null }
const kickHover = () => { for (const h of hoverers) h() }

const makeHover = (layout: typeof VLAYOUT, hv: any, getHovered: () => string | null, area: any, tickMs = 40) => {
 let hoverT: any = null
 const pump = () => {
     let busy = false
     const hovered = getHovered()
     for (const s of layout) { const tgt = hovered === s.k ? 1 : 0; const cur = hv[s.k] || 0; if (Math.abs(tgt - cur) > 0.015) { hv[s.k] = cur + (tgt - cur) * 0.3; busy = true } else if (cur !== tgt) hv[s.k] = tgt }
     if (busy) { area.queue_draw(); if (!hoverT) hoverT = interval(tickMs, pump) }
     else if (hoverT) { hoverT.cancel(); hoverT = null }
 }
 const kick = () => pump()
 return { kick, cancel: () => hoverT && (hoverT.cancel(), (hoverT = null)) }
}

const VertDock = () => {
 const on = {}, open = {}, hv = {}
  const area = DrawingArea({}); area.set_size_request(vsp.width + 10, vsp.height + 20); _dockArea = area
 const recolorV = onColorChange(() => area.queue_draw())
 area.connect("draw", (_w, ctx) => {
 for (const s of VLAYOUT) {
 const t = tileOf(s.k), hov = hv[s.k] || 0, edge = (open[s.k] || (neonBtn.value && hov > 0.04)) ? NEON.dockvh : NEON.dockv
 const fr = vertSlotFrame(s.x, s.y, s.w, s.h)
 const [br, bg, bb] = f([4, 9, 13])
 ctx.newPath(); fr.map(([u, v]) => vsp.project(u, v)).forEach(([x, y]: [number, number], j: number) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
 ctx.setSourceRGBA(br + hov * 0.05, bg + hov * 0.09, bb + hov * 0.11, 0.55 + hov * 0.2); ctx.fill()
 if (hov > 0.02) { ctx.setOperator(12); strokePath(ctx, vsp, fr, edge, hov * 0.5, 3.4, true); ctx.setOperator(2) }
 strokePath(ctx, vsp, fr, edge, Math.min(1, (open[s.k] ? 0.9 : 0.6) + hov * 0.4), 1.4, true)
  const isz = s.h * 0.35
  const ialpha = Math.min(1, (on[s.k] ? 1 : 0.78) + hov * 0.22)
  if (t.eq) drawEq(ctx, vsp, s, edge, ialpha)
  else if (t.key === "notification") {
    tiltImage(ctx, vsp, 45, 98, phoneIcon(), s.h * 0.47, ialpha, (on[s.k] ? 0.4 : 0) + hov * 0.5, 0.08, open[s.k] ? NOTIF_RED : (imgTint.value ? edge : null), open[s.k] ? 0.95 : imgTint.strength)
    const nc = notifCount()
    if (nc > 0) {
      const bx = 58, by = 90, bw = 13, bh = 18, bv = 3
      const oc: [number, number][] = [[bx + bv, by], [bx + bw - bv, by], [bx + bw, by + bv], [bx + bw, by + bh - bv], [bx + bw - bv, by + bh], [bx + bv, by + bh], [bx, by + bh - bv], [bx, by + bv]]
      const op = oc.map(([u, v]) => vsp.project(u, v))
      ctx.newPath(); op.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
      const nbc = notifBubble.value ?? NEON.press
      ctx.setSourceRGBA(nbc[0] / 255, nbc[1] / 255, nbc[2] / 255, 0.92); ctx.fill()
      const ccx = op.reduce((s, p) => s + p[0], 0) / 8, ccy = op.reduce((s, p) => s + p[1], 0) / 8
      const ang = Math.atan2(op[1][1] - op[0][1], op[1][0] - op[0][0])
      const psc = Math.hypot(op[2][0] - op[1][0], op[2][1] - op[1][1]) / bv
      ctx.save(); ctx.translate(ccx, ccy); ctx.rotate(ang * 0.38); ctx.scale(psc, psc)
      ctx.selectFontFace(TITLE, 0, 1); ctx.setFontSize(bh * 0.45)
      const tw = ctx.textExtents(String(nc)).width
      ctx.setSourceRGBA(0, 0, 0, 1); ctx.moveTo(-tw / 2, bh * 0.2); ctx.showText(String(nc))
      ctx.restore()
    }
  }
  else tiltText(ctx, vsp, s.x + s.w / 2, s.y + s.h * 0.60, t.icon, ICONF, isz, edge, ialpha, { align: "c", extraRotate: 0.10, glow: (on[s.k] ? 0.4 : 0) + hov * 0.5 })
 drawBadgeBox(ctx, vsp, 0, s.y + (s.h - BADGE) / 2, BADGE, t.sc, edge)
 }
 return false
 })
 const hitSlot = (x: number, y: number): string | null => {
 for (const s of VLAYOUT) if (pip(x, y, vertSlotFrame(s.x, s.y, s.w, s.h).map(([u, v]) => vsp.project(u, v)) as [number, number][])) return s.k
 for (const s of HLAYOUT) if (pip(x, y, horizSlotFrame(s.x, s.y, s.w, s.h).map(([u, v]) => hsp.project(u, v)) as [number, number][])) return s.k
 return null
 }
 let openRefresh = () => {}
 const hover = makeHover(VLAYOUT, hv, () => hoverBus.key, area)
 hoverers.push(hover.kick)
 const evt = EventBox({ child: area })
 let musicTap: any = null
 try { evt.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK) } catch {}
 evt.connect("button-press-event", (_w, e) => { let x = 0, y = 0; try { const c = e.get_coords?.(); if (c) { x = c[1]; y = c[2] } } catch {} const k = hitSlot(x, y); if (!k) return false; if (k === "music") { let dbl = false; try { dbl = e.get_event_type() === Gdk.EventType.DOUBLE_BUTTON_PRESS } catch {} if (dbl) { if (musicTap) { musicTap.cancel(); musicTap = null } playPauseActive() } else { if (musicTap) musicTap.cancel(); musicTap = timeout(230, () => { musicTap = null; togglePlayer(); openRefresh() }) } } else if (k === "notification") { toggleNotifHud(); openRefresh() } else if (k === "rec") { sh(`${CYBER_DIR}/scripts/screenrecord`); openRefresh() } else { toggleModal(k); openRefresh() } return false })
 evt.connect("motion-notify-event", (_w, e) => { let x = 0, y = 0; try { const c = e.get_coords?.(); if (c) { x = c[1]; y = c[2] } } catch {} hoverBus.key = hitSlot(x, y); kickHover(); return false })
 evt.connect("leave-notify-event", () => { hoverBus.key = null; kickHover(); return false })
 openRefresh = () => { let ch = false; for (const s of VLAYOUT) { const o = s.k === "music" ? isPlayerOpen() : s.k === "notification" ? isNotifHudOpen() : isModalOpen(s.k); if (o !== open[s.k]) { open[s.k] = o; ch = true } } if (ch) area.queue_draw() }
 const stateRefresh = () => { VLAYOUT.forEach(s => { const t = tileOf(s.k); (t.state ? t.state() : Promise.resolve(true)).then(v => { if (v !== on[s.k]) { on[s.k] = v; area.queue_draw() } }).catch(() => {}) }) }
 stateRefresh()
 let mTick: any = null
 const eqPump = () => {
     if (!musicPlaying) { if (mTick) { mTick.cancel(); mTick = null } return }
     for (let i = 0; i < eqBars.length; i++) eqBars[i] = 0.12 + Math.random() * 0.88
     area.queue_draw()
     if (!mTick) mTick = interval(110, eqPump)
 }
 const musicPoll = () => sh("playerctl -a status 2>/dev/null").then(o => { const p = /playing/i.test(o); musicPlaying = p; if (p !== on["music"]) { on["music"] = p; area.queue_draw() } eqPump() }).catch(() => {})
 musicPoll()
 openRefresh()
 onModalChange(openRefresh); onPlayerChange(openRefresh); onNotifHudChange(openRefresh)
 const a = interval(6000, stateRefresh), mp = interval(1500, musicPoll)
 area.connect("destroy", () => { a.cancel(); mp.cancel(); mTick && mTick.cancel(); hover.cancel(); recolorV() })
  return evt
}

const HorizDock = () => {
 const on = {}, open = {}, hv = {}
  const area = DrawingArea({}); area.set_size_request(hsp.width, hsp.height)
 const recolorH = onColorChange(() => area.queue_draw())
 area.connect("draw", (_w, ctx) => {
 for (const s of HLAYOUT) {
 const t = tileOf(s.k), hov = hv[s.k] || 0, edge = (open[s.k] || (neonBtn.value && hov > 0.04)) ? NEON.dockhh : NEON.dockh
 const fr = horizSlotFrame(s.x, s.y, s.w, s.h)
 const [br, bg, bb] = f([4, 9, 13])
 ctx.newPath(); fr.map(([u, v]) => hsp.project(u, v)).forEach(([x, y]: [number, number], j: number) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
 ctx.setSourceRGBA(br + hov * 0.05, bg + hov * 0.09, bb + hov * 0.11, 0.55 + hov * 0.2); ctx.fill()
 if (hov > 0.02) { ctx.setOperator(12); strokePath(ctx, hsp, fr, edge, hov * 0.5, 3.4, true); ctx.setOperator(2) }
 strokePath(ctx, hsp, fr, edge, Math.min(1, (open[s.k] ? 0.9 : 0.6) + hov * 0.4), 1.4, true)
  const isz = s.h * 0.42
  tiltText(ctx, hsp, s.x + s.w / 2 + 0.5, s.y + s.h * 0.62, t.icon, ICONF, isz, edge, Math.min(1, (on[s.k] ? 1 : 0.78) + hov * 0.22), { align: "c",extraRotate: 0.05, glow: (on[s.k] ? 0.4 : 0) + hov * 0.5 })
 drawBadgeBox(ctx, hsp, s.x + (s.w - BADGE) / 2, HSH + BGAP, BADGE, t.sc, edge)
 }
 return false
 })
 const hitSlot = (x: number, y: number): string | null => {
 for (const s of HLAYOUT) if (pip(x, y, horizSlotFrame(s.x, s.y, s.w, s.h).map(([u, v]) => hsp.project(u, v)) as [number, number][])) return s.k
 return null
 }
 let openRefresh = () => {}
 const hover = makeHover(HLAYOUT, hv, () => hoverBus.key, area)
 hoverers.push(hover.kick)
 const evt = EventBox({ child: area })
 try { evt.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK) } catch {}
 evt.connect("button-press-event", (_w, e) => { let x = 0, y = 0; try { const c = e.get_coords?.(); if (c) { x = c[1]; y = c[2] } } catch {} const k = hitSlot(x, y); if (k) { if (k === "rec") sh(`${CYBER_DIR}/scripts/screenrecord`); else toggleModal(k); openRefresh() } return false })
 evt.connect("motion-notify-event", (_w, e) => { let x = 0, y = 0; try { const c = e.get_coords?.(); if (c) { x = c[1]; y = c[2] } } catch {} hoverBus.key = hitSlot(x, y); kickHover(); return false })
 evt.connect("leave-notify-event", () => { hoverBus.key = null; kickHover(); return false })
 openRefresh = () => { for (const s of HLAYOUT) open[s.k] = isModalOpen(s.k); area.queue_draw() }
 const stateRefresh = () => { HLAYOUT.forEach(s => { const t = tileOf(s.k); (t.state ? t.state() : Promise.resolve(true)).then(v => { if (v !== on[s.k]) { on[s.k] = v; area.queue_draw() } }).catch(() => {}) }) }
 stateRefresh()
 openRefresh()
 onModalChange(openRefresh)
 const a = interval(6000, stateRefresh)
 area.connect("destroy", () => { a.cancel(); hover.cancel(); recolorH() })
  return evt
}

export const Toggles = () => Box({ className: "dock", children: [VertDock()] })

export { HorizDock }
