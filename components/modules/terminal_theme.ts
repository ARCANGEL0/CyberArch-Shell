

import { createModal, sectionHeader, drawBtn } from "./cmodal.ts"
import { txt, TITLE, MONO } from "./glass.ts"
import { USER } from "./colors.ts"
import { CYBER_DIR, USER_DIR } from "../../env.ts"
import { execAsync } from "astal"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=3.0"


const RIO = `${GLib.get_home_dir()}/.config/rio`
const RTDIR = `${USER_DIR}/rio_themes`
const MARK = `${RIO}/.rio-style`
const CFG = `${USER_DIR}/rio_theme.json`
const ROWH = 30


const rd = (p: string) => { try { const [ok, b] = GLib.file_get_contents(p); return ok ? new TextDecoder().decode(b) : "" } catch { return "" } }
const wr = (p: string, s: string) => { try { GLib.file_set_contents(p, s) } catch { } }

const hexes = (p: string): string[] => {
    const s = rd(p), i = s.indexOf("[colors]")
    const m = (i >= 0 ? s.slice(i) : s).match(/#[0-9a-fA-F]{6}/g) || []
    return m.slice(0, 5)
}
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
const tild = (p: string) => p.replace(GLib.get_home_dir(), "~")

const scan = (dir: string, tag: string, out: any[]) => {
    if (!dir) return
    try {
        const d = GLib.Dir.open(dir, 0)
        let n: string | null = d.read_name()
        while (n) {
            if (n.endsWith(".toml") && !out.some((o) => o.name === n.slice(0, -5))) {
                out.push({ name: n.slice(0, -5), tag, hex: hexes(`${dir}/${n}`) })
            }
            n = d.read_name()
        }
        d.close()
    } catch { }
}


export const TerminalThemeCtrl = () => {
    const st: any = { list: [], cur: "", dir: "", scroll: 0, edit: false, buf: "" }
    let ctrl: any

    const dir = () => st.dir || RTDIR
    const collect = () => { st.list = []; scan(`${CYBER_DIR}/assets/rio/styles`, "core", st.list); scan(dir(), st.dir ? "custom" : "user", st.list) }
    const load = () => { try { st.dir = JSON.parse(rd(CFG) || "{}").dir || "" } catch { st.dir = "" }; GLib.mkdir_with_parents(RTDIR, 0o755); collect(); st.cur = rd(MARK).trim() }
    const put = (t: any) => { execAsync([`${CYBER_DIR}/scripts/rio-style`, t.name, dir()]).catch(() => ""); st.cur = t.name; ctrl.requestDraw() }

    ctrl = createModal({
        name: "termtheme", tabTitle: "TERMINAL THEME", W: 434, H: 492,
        col: USER.sysveil as any, accent: USER.sysveil as any,
        onOpen: () => load(),
        onScroll: (d) => { st.scroll = Math.max(0, st.scroll + d * ROWH); ctrl.requestDraw() },
        onKey: (k) => {
            if (!st.edit) return
            if (k === Gdk.KEY_Escape) { st.edit = false; ctrl.requestDraw(); return true }
            if (k === Gdk.KEY_Return) { st.dir = st.buf.trim().replace(/^~(?=\/|$)/, GLib.get_home_dir()); st.edit = false; wr(CFG, JSON.stringify({ dir: st.dir })); collect(); ctrl.requestDraw(); return true }
            if (k === Gdk.KEY_BackSpace) { st.buf = st.buf.slice(0, -1); ctrl.requestDraw(); return true }
            const u = Gdk.keyval_to_unicode(k)
            if (u >= 32 && u < 0x10000) { st.buf += String.fromCharCode(u); ctrl.requestDraw() }
            return true
        },
        draw: (ctx, g) => {
            const x = g.X + 22, w = g.w - 44
            let cy = g.Y + 52

            txt(ctx, x, cy, "// ACTIVE", MONO, 9, g.col, 0.68)
            txt(ctx, x + 76, cy, (st.cur || "none").toUpperCase(), MONO, 10, g.accent, 0.96)
            const act = st.list.find((t: any) => t.name === st.cur)
            if (act) act.hex.slice(0, 5).forEach((h: string, i: number) => { const c = rgb(h); ctx.setSourceRGBA(c[0], c[1], c[2], 0.95); ctx.rectangle(g.X + g.w - 22 - (act.hex.length - i) * 15, cy - 9, 12, 12); ctx.fill() })
            cy += 22

            sectionHeader(ctx, g, x, cy, "// AVAILABLE", w, 9)
            cy += 12

            const top = cy, bot = g.Y + g.h - 118
            const maxS = Math.max(0, st.list.length * ROWH - (bot - top))
            if (st.scroll > maxS) st.scroll = maxS

            ctx.save(); ctx.rectangle(x - 4, top, w + 8, bot - top); ctx.clip()
            st.list.forEach((t: any, i: number) => {
                const ry = top + i * ROWH - st.scroll
                if (ry + ROWH < top || ry > bot) return
                const key = `rt|${t.name}`
                const hov = g.push.hoverKey === key, on = t.name === st.cur
                const c = hov ? g.accent : g.col
                if (hov || on) { ctx.setSourceRGBA(c[0], c[1], c[2], on ? 0.15 : 0.09); ctx.rectangle(x - 4, ry + 2, w + 8, ROWH - 6); ctx.fill() }
                const sw = t.hex.length ? t.hex.slice(0, 4) : ["#5a5a5a"]
                sw.forEach((h: string, k: number) => { const q = rgb(h); ctx.setSourceRGBA(q[0], q[1], q[2], on ? 0.98 : 0.82); ctx.rectangle(x, ry + 9, 11, 11); ctx.fill() })
                txt(ctx, x + 62, ry + 21, t.name.toUpperCase(), TITLE, 12, on ? g.accent : g.col, on ? 1 : 0.85)
                txt(ctx, g.X + g.w - 22 - 62, ry + 21, t.tag.toUpperCase(), MONO, 8, g.col, 0.38)
                if (on) txt(ctx, g.X + g.w - 22 - 96, ry + 21, "◂ ACTIVE", MONO, 8, g.accent, 0.9)
                g.push({ kind: "btn", hoverable: true, key, bx0: x - 4, by0: ry + 2, bx1: x + w + 4, by1: ry + ROWH - 4, on: () => put(t) })
            })
            ctx.restore()

            if (maxS > 0) {
                const fh = Math.max(16, (bot - top) * ((bot - top) / (st.list.length * ROWH)))
                const fy2 = top + (bot - top - fh) * (st.scroll / maxS)
                ctx.setSourceRGBA(g.accent[0], g.accent[1], g.accent[2], 0.55); ctx.rectangle(g.X + g.w - 12, fy2, 2.5, fh); ctx.fill()
            }

            const fy = g.Y + g.h - 106
            ctx.setSourceRGBA(g.col[0], g.col[1], g.col[2], 0.22); ctx.rectangle(x, fy, w, 1); ctx.fill()
            txt(ctx, x, fy + 18, "// CUSTOM THEME PATH", MONO, 9, g.col, 0.68)
            txt(ctx, x, fy + 36, st.edit ? st.buf + "_" : tild(dir()), MONO, 10, st.edit ? g.accent : g.col, st.edit ? 0.98 : st.dir ? 0.78 : 0.58)
            g.push({ kind: "btn", hoverable: true, key: "tpath", bx0: x - 4, by0: fy + 22, bx1: x + w - 92, by1: fy + 48, on: () => { st.buf = dir(); st.edit = true; ctrl.requestDraw() } })
            drawBtn(ctx, g.push, x + w - 88, fy + 24, 42, 24, "SET", () => { st.buf = dir(); st.edit = true; ctrl.requestDraw() }, st.edit, g.col, "", 10)
            drawBtn(ctx, g.push, x + w - 42, fy + 24, 42, 24, "CLR", () => { st.dir = ""; wr(CFG, JSON.stringify({ dir: "" })); collect(); ctrl.requestDraw() }, false, g.col, "", 10)
            drawBtn(ctx, g.push, x, fy + 58, w, 30, "REFRESH", () => { collect(); ctrl.requestDraw() }, false, g.col, "", 11)
        },
    })
    return ctrl
}
