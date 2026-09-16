import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../../env.ts"
import { Cairo, TITLE, txt } from "./glass.ts"
import { createModal } from "./cmodal.ts"
import { USER } from "./colors.ts"
import {
    readTune, TABS,
    drawColors, drawKeybinds, drawConfig, drawWm, drawWallRing, drawWallBrowse,
    wallOpen, kbScroll, kbMaxScroll, setKbScroll
} from "./themesettings.ts"
import { startModalStats, stopModalStats } from "./sys.ts"

const SW = SCREEN_WIDTH, SH = SCREEN_HEIGHT
const SYSR: [number, number, number] = [1, 0.46, 0.5]
const SYSC: [number, number, number] = USER.modalhov || [0.28, 0.82, 0.86]

export const ThemeSettingsCtrl = () => {
    const st: any = { tab: "anim" }
    let ctrl: any

    ctrl = createModal({
        name: "themesettings",
        tabTitle: "THEME SETTINGS",
        W: SW,
        H: SH,
        noGlass: true,
        pad: 0,
        onOpen: () => {
            readTune()
        },
        onClose: () => {
            stopModalStats()
        },
        onScroll: (d) => {
            if (st.tab === "keybinds" || st.tab === "wm" || st.tab === "anim" || st.tab === "colors") {
                const newScroll = kbScroll + d
                if (newScroll >= 0 && newScroll <= kbMaxScroll) {
                    setKbScroll(newScroll)
                    ctrl.requestDraw()
                }
            }
        },
        draw: (ctx, g) => {
            const X = g.X, Y = g.Y, W = g.w, H = g.h
            const FW = SW, FH = SH

            ctx.setSourceRGBA(0.015, 0.02, 0.03, 0.42)
            ctx.rectangle(0, 0, FW, FH)
            ctx.fill()

            const pulse = 0.94 + 0.06 * Math.sin(Date.now() / 500)
            const vcx = FW / 2, vcy = FH / 2, reach = Math.hypot(FW, FH) / 2
            const vg = new Cairo.RadialGradient(vcx, vcy, reach * 0.16, vcx, vcy, reach * 0.98)
            const [ov0, ov1, ov2] = USER.sysveil || USER.overlay
            vg.addColorStopRGBA(0, ov0 * 0.08, ov1 * 0.08, ov2 * 0.08, 0.46)
            vg.addColorStopRGBA(0.5, ov0 * 0.2, ov1 * 0.2, ov2 * 0.2, 0.68)
            vg.addColorStopRGBA(1, ov0 * 0.62, ov1 * 0.62, ov2 * 0.62, 0.92 * pulse)
            ctx.setSource(vg)
            ctx.rectangle(0, 0, FW, FH)
            ctx.fill()

            const hy = Y + 40
            ctx.setSourceRGBA(SYSR[0], SYSR[1], SYSR[2], 0.55)
            ctx.setLineWidth(1)
            ctx.newPath()
            ctx.moveTo(X + 40, hy + 26)
            ctx.lineTo(X + W - 40, hy + 26)
            ctx.stroke()

            const tabs = TABS
            ctx.selectFontFace(TITLE, 0, 1)
            ctx.setFontSize(13)
            let tw2 = tabs.reduce((a2, [t]) => a2 + ctx.textExtents(t).width + 30, 0)
            let tx3 = X + W / 2 - tw2 / 2

            tabs.forEach(([t, id]) => {
                const w2 = ctx.textExtents(t).width
                const active = st.tab === id
                const hv = g.push.hoverKey === `tab:${id}`
                const tcol: any = active ? SYSC : (hv ? [1, 0.55, 0.5] : SYSR)

                if (hv && !active) {
                    ctx.setSourceRGBA(tcol[0], tcol[1], tcol[2], 0.06 + 0.04 * Math.sin(Date.now() / 130))
                    ctx.rectangle(tx3 - 8, hy, w2 + 16, 28)
                    ctx.fill()
                }

                txt(ctx, tx3, hy + 16, t, TITLE, 13, tcol, active ? 0.98 : (hv ? 0.9 : 0.72), 1)

                if (active) {
                    ctx.setSourceRGBA(SYSC[0], SYSC[1], SYSC[2], 0.95)
                    ctx.rectangle(tx3, hy + 23, w2, 2)
                    ctx.fill()
                }

                g.push({
                    kind: "tab",
                    key: `tab:${id}`,
                    hoverable: true,
                    bx0: tx3 - 10,
                    by0: hy,
                    bx1: tx3 + w2 + 10,
                    by1: hy + 28,
                    on: () => {
                        st.tab = id
                        setKbScroll(0)
                        ctrl.requestDraw()
                    }
                })

                tx3 += w2 + 30
            })

            const mx = X + 350, mw = W - 700
            const cy3 = Y + 150

            if (st.tab === "colors") {
                drawColors(ctx, g, mx, cy3, mw)
            } else if (st.tab === "keybinds") {
                drawKeybinds(ctx, g, mx, cy3, mw)
            } else if (st.tab === "anim") {
                drawConfig(ctx, g, mx, cy3, mw)
            } else if (st.tab === "wm") {
                drawWm(ctx, g, mx, cy3, mw)
            } else if (st.tab === "wall") {
                if (wallOpen) {
                    drawWallBrowse(ctx, g, mx, cy3, mw)
                } else {
                    drawWallRing(ctx, g, mx, cy3, mw)
                }
            }
        },
    })

    return ctrl
}
