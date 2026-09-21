import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../../env.ts"
import { Cairo, TITLE, txt } from "./glass.ts"
import { createModal } from "./cmodal.ts"
import { USER } from "./colors.ts"
import Gdk from "gi://Gdk?version=3.0"
import {
    readTune, TABS,
    drawColors, drawKeybinds, drawConfig, drawWm, drawWallRing, drawWallBrowse, drawWallPicker,
    wallOpen, wallPickerOpen, wallPickerScroll, setWallPickerScroll, wallPickerKey,
    kbScroll, kbMaxScroll, setKbScroll
} from "./themesettings.ts"
import { startModalStats, stopModalStats } from "./sys.ts"

const SW = SCREEN_WIDTH, SH = SCREEN_HEIGHT
const tabBase = (): [number, number, number] => USER.sysveil as any
const tabAcc = (): [number, number, number] => USER.cyan as any

export const ThemeSettingsCtrl = () => {
    const st: any = { tab: TABS[0][1] }
    let ctrl: any

    ctrl = createModal({
        name: "themesettings",
        tabTitle: "THEME SETTINGS",
        W: SW,
        H: SH,
        noGlass: true,
        pad: 0,
        idleFrameMs: 70,
        col: USER.sysveil as any,
        accent: USER.sysveil as any,
        onOpen: () => {
            st.tab = TABS[0][1]
            setKbScroll(0)
            readTune()
        },
        onClose: () => {
            stopModalStats()
        },
        onScroll: (d) => {
            if (st.tab === "wall" && wallPickerOpen) {
                setWallPickerScroll(wallPickerScroll + d * 36)
                ctrl.requestDraw()
                return
            }
            if (st.tab === "keybinds" || st.tab === "wm" || st.tab === "anim" || st.tab === "colors") {
                const newScroll = kbScroll + d * 36
                if (newScroll >= 0 && newScroll <= kbMaxScroll) {
                    setKbScroll(newScroll)
                    ctrl.requestDraw()
                }
            }
        },
        onKey: (k) => {
            if (st.tab === "wall" && wallPickerOpen) {
                if (wallPickerKey(k)) return true
            }
            if (k === Gdk.KEY_Left || k === Gdk.KEY_Right) {
                const idx = TABS.findIndex(([, id]) => id === st.tab)
                if (idx < 0) return
                const next = k === Gdk.KEY_Left ? idx - 1 : idx + 1
                if (next >= 0 && next < TABS.length) {
                    st.tab = TABS[next][1]
                    setKbScroll(0)
                    ctrl.requestDraw()
                }
                return true
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
            const base = tabBase(), acc = tabAcc()
            ctx.setSourceRGBA(base[0], base[1], base[2], 0.3)
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
                const tcol: any = active ? acc : (hv ? acc : base)

                txt(ctx, tx3, hy + 16, t, TITLE, 13, tcol, active ? 0.98 : (hv ? 0.9 : 0.6), 1)

                if (active || hv) {
                    ctx.setSourceRGBA(acc[0], acc[1], acc[2], active ? 0.95 : 0.55)
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
                if (wallPickerOpen) {
                    drawWallPicker(ctx, g, mx, cy3, mw)
                } else if (wallOpen) {
                    drawWallBrowse(ctx, g, mx, cy3, mw)
                } else {
                    drawWallRing(ctx, g, mx, cy3, mw)
                }
            }
        },
    })

    return ctrl
}
