import { Window, Box, DrawingArea, EventBox } from "./widget.ts"
import { Anchor, Layer, Exclusivity } from "./widget.ts"
import Gdk from "gi://Gdk?version=3.0"
import GdkPixbuf from "gi://GdkPixbuf"
import { interval } from "astal"
import { CYBER_DIR } from "../../env.ts"
import { makePlane, tiltText, fillQuad, strokePath } from "./proj.ts"
import { NEON, f, onColorChange, imgTint, tintSurface, neonBtn, launcherTint, launcherLabelTint } from "./colors.ts"
import { openAppsMenu } from "./appsmenu.ts"
import { animOn } from "./config.ts"

import { TITLE } from "./fonts.ts"
const W = 180, H = 180
const plane = makePlane({ w: W, h: H, yaw: -16, pitch: 1, roll: 4, focal: 1180, dist: 1180, pad: 1 })
const prompt = makePlane({ w: W, h: 14, yaw: -14, pitch: -1.5, roll: 2.5, focal: 1180, dist: 1180, pad: 5 })

let ICON: any = null
try { ICON = GdkPixbuf.Pixbuf.new_from_file(`${CYBER_DIR}/assets/icons/launcher.png`) } catch (e) { print("[launcher] launcher.png:", e) }

export const LauncherWindow = (mon?) => {
 const area = DrawingArea({}); area.set_size_request(plane.width, plane.height)
 onColorChange(() => area.queue_draw())
 let hover = false
 let flick = 1

 area.connect("draw", (_w, ctx) => {
     const [rr, rg, rb] = f(NEON.red)

     const tx = 8, ty = 28
     const col = hover ? (neonBtn.value ? NEON.press : NEON.cyan) : (launcherLabelTint.value || NEON.dock), fl = hover ? flick : 1
     tiltText(ctx, prompt, tx, ty, "Apps Launcher", TITLE, 15, col, (hover ? 1 : 0.95) * fl, { bold: true, glow: (hover ? 0.32 : 0.2) * fl, bloom: (hover ? 0.6 : 0.45) * fl, shadow: 1 })

     const chW = 46, chH = 20, chX = 130, chY = 13
     const boxPts: [number, number][] = [[chX, chY], [chX + chW, chY], [chX + chW, chY + chH], [chX, chY + chH]]
     fillQuad(ctx, prompt, chX, chY, chX + chW, chY + chH, NEON.dock, hover ? 0.18 : 0.10)
     ctx.setOperator(12); strokePath(ctx, prompt, boxPts, NEON.dock, hover ? 0.34 : 0.2, 5, true); ctx.setOperator(2)
     strokePath(ctx, prompt, boxPts, NEON.dock, hover ? 1 : 0.85, 1.5, true)
     tiltText(ctx, prompt, chX + chW / 2, chY + chH / 2 + 4, "SUPER TAB", TITLE, 8, NEON.dock, hover ? 1 : 0.9, { bold: true, align: "c", glow: 0.3 })

     if (ICON) {
         const iconW = 160, iconH = 100, ix = W - iconW , iy = 76
         const pbW = ICON.get_width(), pbH = ICON.get_height()
         const cu = ix + iconW / 2, cv = iy + iconH / 2
         const pc = plane.project(cu, cv), pr = plane.project(cu + iconW / 2, cv), pbm = plane.project(cu, cv + iconH / 2)
         const halfW = Math.hypot(pr[0] - pc[0], pr[1] - pc[1]), halfH = Math.hypot(pbm[0] - pc[0], pbm[1] - pc[1])
         const ang = Math.atan2(pr[1] - pc[1], pr[0] - pc[0])
         ctx.save()
         ctx.translate(pc[0], pc[1]); ctx.rotate(ang); ctx.scale((2 * halfW) / pbW, (2 * halfH) / pbH)
         Gdk.cairo_set_source_pixbuf(ctx, ICON, -pbW / 2, -pbH / 2); ctx.paintWithAlpha(1)
         ctx.rectangle(-pbW / 2, -pbH / 2, pbW, pbH); ctx.clip()
         const ltc = imgTint.value
         const [tr, tg, tb] = hover ? (neonBtn.value ? f(NEON.press) : f(NEON.cyan)) : (launcherTint.value ? f(launcherTint.value) : (ltc ? f(ltc) : [rr, rg, rb]))
         ctx.setOperator(5); ctx.setSourceRGBA(tr, tg, tb, hover ? 0.62 : ((launcherTint.value || ltc) ? 0.85 : 0.42)); ctx.paint(); ctx.setOperator(2)
         if (hover) {
             ctx.setOperator(12)
             Gdk.cairo_set_source_pixbuf(ctx, ICON, -pbW / 2, -pbH / 2)
             const glowPat = ctx.getSource()
             ctx.setSourceRGBA(tr, tg, tb, 0.45 * flick); ctx.mask(glowPat)
             ctx.setOperator(2)
         }
         ctx.restore()
     }
     return false
 })

 let flickT: any = null
 const flip = () => {
     if (!hover || !animOn("animWheel")) {
         if (flick !== 1) { flick = 1; area.queue_draw() }
         if (flickT) { flickT.cancel(); flickT = null }
         return
     }
     flick = Math.random() < 0.12 ? 0.4 + Math.random() * 0.35 : 0.9 + Math.random() * 0.1
     area.queue_draw()
     if (!flickT) flickT = interval(110, flip)
 }

 const evt = EventBox({ child: area })
 try { evt.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK) } catch {}
 evt.connect("button-press-event", () => { try { openAppsMenu() } catch (e) { print(e) } return false })
 evt.connect("enter-notify-event", () => { hover = true; area.queue_draw(); flip(); return false })
 evt.connect("leave-notify-event", () => { hover = false; area.queue_draw(); flip(); return false })

 return Window({
     name: "launcher", className: "aug launcher", gdkmonitor: mon, anchor: Anchor.BOTTOM | Anchor.RIGHT,
     layer: Layer.BOTTOM, exclusivity: Exclusivity.IGNORE,
     child: Box({ className: "launcher-wrap", child: evt }),
 })
}
