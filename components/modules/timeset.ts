import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { execAsync } from "astal"
import { createModal } from "./cmodal.ts"
import { txt as gtxt, pango as gpango, RED, RACC, Cairo, HEADER as GHEAD, TITLE as GTITLE, MONO as GMONO } from "./glass.ts"

const YEL: [number, number, number] = [252 / 255, 238 / 255, 10 / 255]
const ARA: [number, number, number] = RACC
const AC2: [number, number, number] = [1, 0.68, 0.7]
const HOT: [number, number, number] = [255 / 255, 42 / 255, 58 / 255]

const pad2 = (n: number) => String(n).padStart(2, "0")

const chamfer = (ctx, x, y, w, h, c = 11) => {
    ctx.newPath()
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c)
    ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.closePath()
}
const bracket = (ctx, x, y, w, h, col, a, len = 9) => {
    ctx.setSourceRGBA(col[0], col[1], col[2], a); ctx.setLineWidth(1.6)
    ctx.newPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke()
    ctx.newPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke()
    ctx.newPath(); ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h); ctx.stroke()
}
const hatch = (ctx, x, y, w, h, col, a, gap = 7) => {
    ctx.save(); ctx.rectangle(x, y, w, h); ctx.clip()
    ctx.setSourceRGBA(col[0], col[1], col[2], a); ctx.setLineWidth(0.8)
    for (let i = -h; i < w; i += gap) { ctx.newPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke() }
    ctx.restore()
}
const ghost = (ctx, x, y, s, font, size, a = 0.4) => gtxt(ctx, x - 2, y + 1.2, s, font, size, HOT, a, 1)

const holoPane = (ctx, x, y, w, h) => {
    const c = 22
    const body = new Cairo.LinearGradient(x, y, x, y + h)
    body.addColorStopRGBA(0, 0.075, 0.010, 0.022, 0.80)
    body.addColorStopRGBA(0.45, 0.032, 0.005, 0.012, 0.76)
    body.addColorStopRGBA(1, 0.062, 0.008, 0.018, 0.79)
    chamfer(ctx, x, y, w, h, c); ctx.setSource(body); ctx.fill()

    const edge = new Cairo.LinearGradient(x, y, x + w * 0.35, y + h)
    edge.addColorStopRGBA(0, HOT[0], HOT[1], HOT[2], 0.10)
    edge.addColorStopRGBA(0.35, HOT[0], HOT[1], HOT[2], 0.0)
    ctx.save(); chamfer(ctx, x, y, w, h, c); ctx.clip()
    ctx.setOperator(12); ctx.setSource(edge); ctx.rectangle(x, y, w, h); ctx.fill(); ctx.setOperator(2)
    ctx.restore()

    chamfer(ctx, x, y, w, h, c); ctx.setSourceRGBA(HOT[0], HOT[1], HOT[2], 0.10); ctx.setLineWidth(9); ctx.stroke()
    chamfer(ctx, x, y, w, h, c); ctx.setSourceRGBA(HOT[0], HOT[1], HOT[2], 0.26); ctx.setLineWidth(3.4); ctx.stroke()
    chamfer(ctx, x, y, w, h, c); ctx.setSourceRGBA(1, 0.46, 0.48, 0.98); ctx.setLineWidth(1.2); ctx.stroke()

    ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.92); ctx.rectangle(x, y, 46, 3); ctx.fill()
    ctx.setSourceRGBA(HOT[0], HOT[1], HOT[2], 0.8); ctx.rectangle(x + 52, y, w - 52, 3); ctx.fill()
}

const WD = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
const MON3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

let modal: any = null
let tick = 0
let zones: string[] = [], curZone = "—", ntp = false, rtc = "—"
let query = "", results: string[] = [], scroll = 0, hint = "TYPE TO FILTER", status = ""
let statusUntil = 0
let searchTimer: number | null = null
let focusField = "filter"
let mDate = "", mTime = ""
let authOpen = false, authPw = "", authMsg = "", authBusy = false
let authArgs: string[] | null = null, authLabel = "", drawingAuth = false

const say = (s: string) => { status = s; statusUntil = Date.now() + 4500; modal?.requestDraw() }

const seedManual = () => {
    const d = new Date()
    mDate = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    mTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

const readState = async () => {
    try {
        const out = await execAsync(["timedatectl", "show", "--property=Timezone", "--property=NTP", "--property=RTCTimeUSec"])
        for (const line of out.split("\n")) {
            const [k, v] = line.split("=")
            if (k === "Timezone") curZone = v || "—"
            else if (k === "NTP") ntp = v === "yes"
            else if (k === "RTCTimeUSec") rtc = (v || "").replace(/^[A-Za-z]{3}\s+/, "").slice(0, 19)
        }
    } catch (e) { print("[cyber] timedatectl show:", e) }
    modal?.requestDraw()
}

const loadZones = async () => {
    if (zones.length) return
    try { zones = (await execAsync(["timedatectl", "list-timezones"])).split("\n").filter(Boolean) }
    catch (e) { print("[cyber] list-timezones:", e) }
    runFilter()
}

const runFilter = () => {
    const q = query.trim().toLowerCase()
    results = (q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones).slice(0, 400)
    hint = q ? (results.length ? `${results.length} MATCHES` : "NO MATCHES") : `${zones.length} ZONES`
    scroll = 0
    modal?.requestDraw()
}
const queueFilter = () => {
    if (searchTimer !== null) GLib.source_remove(searchTimer)
    searchTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => { searchTimer = null; runFilter(); return false })
}

const askAuth = (args: string[], label: string) => {
    authArgs = args; authLabel = label; authPw = ""; authBusy = false
    authMsg = "ROOT AUTHORIZATION REQUIRED"
    authOpen = true; modal?.requestDraw()
}
const runPriv = async (args: string[], label: string) => {
    try { await execAsync(["sudo", "-n", "timedatectl", ...args]); await readState(); seedManual(); say(label) }
    catch (e) { askAuth(args, label) }
}
const submitAuth = () => {
    if (!authArgs || authBusy) return
    if (!authPw) { authMsg = "ENTER PASSCODE"; modal?.requestDraw(); return }
    authBusy = true; authMsg = "VERIFYING…"; modal?.requestDraw()
    try {
        const proc = Gio.Subprocess.new(["sudo", "-S", "-p", "", "timedatectl", ...authArgs],
            Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE)
        proc.communicate_utf8_async(authPw + "\n", null, (pr, res) => {
            let ok = false
            try { pr.communicate_utf8_finish(res); ok = pr.get_successful() } catch (e) { ok = false }
            authPw = ""; authBusy = false
            if (ok) { authOpen = false; authArgs = null; readState(); seedManual(); say(authLabel) }
            else { authMsg = "ACCESS DENIED — RETRY"; modal?.requestDraw() }
        })
    } catch (e) { authBusy = false; authMsg = "SUDO UNAVAILABLE"; print("[cyber] auth:", e); modal?.requestDraw() }
}
const cancelAuth = () => { authOpen = false; authPw = ""; authArgs = null; modal?.requestDraw() }
const setZone = (z: string) => runPriv(["set-timezone", z], `TIMEZONE SET · ${z}`)
const setNtp = (on: boolean) => runPriv(["set-ntp", on ? "true" : "false"], on ? "NET SYNC ON" : "NET SYNC OFF")
const pushTime = (stamp: string, label: string) => {
    if (ntp) { say("DISABLE NET SYNC FIRST"); return }
    runPriv(["set-time", stamp], label)
}
const nudge = (mins: number) => {
    const d = new Date(Date.now() + mins * 60000)
    const s = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    pushTime(s, `CLOCK ${mins > 0 ? "+" : ""}${mins}m`)
}
const applyManual = () => {
    const stamp = `${mDate.trim()} ${mTime.trim()}`
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(stamp)) { say("FORMAT · YYYY-MM-DD HH:MM:SS"); return }
    pushTime(stamp, `CLOCK SET · ${stamp}`)
}

const chip = (ctx, g, x, y, w, h, label, on, act, col = ARA) => {
    const c = on ? YEL : col
    chamfer(ctx, x, y, w, h, 7)
    ctx.setSourceRGBA(c[0] * 0.26, c[1] * 0.34, c[2] * 0.42, on ? 0.3 : 0.1); ctx.fill()
    chamfer(ctx, x, y, w, h, 7)
    ctx.setSourceRGBA(c[0], c[1], c[2], on ? 0.95 : 0.38); ctx.setLineWidth(on ? 1.3 : 0.9); ctx.stroke()
    if (on) { ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.9); ctx.rectangle(x, y, w, 2); ctx.fill() }
    ctx.selectFontFace(GTITLE, 0, 1); ctx.setFontSize(11)
    gtxt(ctx, x + w / 2 - ctx.textExtents(label).width / 2, y + h / 2 + 4, label, GTITLE, 11, c, on ? 1 : 0.8, 1, on ? 0.35 : 0)
    if (!authOpen || drawingAuth) g.push({ kind: "chip", bx0: x, by0: y, bx1: x + w, by1: y + h, on: act })
}

const field = (ctx, g, x, y, w, h, label, value, id, ph) => {
    const act = focusField === id
    const c = act ? YEL : ARA
    chamfer(ctx, x, y, w, h, 7)
    ctx.setSourceRGBA(c[0] * 0.2, c[1] * 0.28, c[2] * 0.36, act ? 0.3 : 0.14); ctx.fill()
    chamfer(ctx, x, y, w, h, 7)
    ctx.setSourceRGBA(c[0], c[1], c[2], act ? 0.95 : 0.4); ctx.setLineWidth(act ? 1.3 : 0.9); ctx.stroke()
    gtxt(ctx, x + 8, y - 8, label, GMONO, 7.5, act ? YEL : ARA, act ? 0.85 : 0.45)
    const cur = act && (Math.floor(Date.now() / 450) % 2) ? "▌" : ""
    gpango(ctx, x + 12, y + h / 2 + 5, (value || ph) + cur, GTITLE, act, 14, value ? (act ? YEL : AC2) : ARA, value ? 0.97 : 0.35)
    if (!authOpen) g.push({ kind: "field", bx0: x, by0: y, bx1: x + w, by1: y + h, on: () => { focusField = id; modal.requestDraw() } })
}

const ensure = () => {
    if (modal) return
    modal = createModal({
        name: "time", tabTitle: "SYSTEM TIME", W: 620, H: 560,
        col: RED, accent: YEL, yaw: 13, pitch: -3, roll: 0.8, focal: 2400, dist: 2300, noGlass: true, anchorRight: true,
        onOpen: () => { query = ""; scroll = 0; status = ""; tick = 0; focusField = "filter"; seedManual(); readState(); loadZones() },
        onFrame: () => { tick++; if (tick % 8 === 0) modal.requestDraw() },
        onScroll: (d) => { scroll = Math.max(0, Math.min(Math.max(0, results.length - 1), scroll + d * 2)); modal.requestDraw() },
        onKey: (k) => {
            if (authOpen) {
                if (k === Gdk.KEY_Return || k === Gdk.KEY_KP_Enter) { submitAuth(); return }
                if (k === Gdk.KEY_BackSpace) authPw = authPw.slice(0, -1)
                else { const u = Gdk.keyval_to_unicode(k); if (u >= 32 && u < 0x10000) authPw += String.fromCharCode(u); else return }
                if (authMsg !== "ROOT AUTHORIZATION REQUIRED") authMsg = "ROOT AUTHORIZATION REQUIRED"
                modal.requestDraw(); return
            }
            if (k === Gdk.KEY_Tab) {
                focusField = focusField === "filter" ? "date" : focusField === "date" ? "time" : "filter"
                modal.requestDraw(); return
            }
            if (focusField === "filter") {
                if (k === Gdk.KEY_BackSpace) query = query.slice(0, -1)
                else { const u = Gdk.keyval_to_unicode(k); if (u >= 32 && u < 0x10000) query += String.fromCharCode(u); else return }
                queueFilter(); return
            }
            if (k === Gdk.KEY_Return || k === Gdk.KEY_KP_Enter) { applyManual(); return }
            const max = focusField === "date" ? 10 : 8
            const cur = focusField === "date" ? mDate : mTime
            let next = cur
            if (k === Gdk.KEY_BackSpace) next = cur.slice(0, -1)
            else {
                const u = Gdk.keyval_to_unicode(k)
                const chr = u >= 32 && u < 0x10000 ? String.fromCharCode(u) : ""
                if (!/^[0-9:\-]$/.test(chr) || cur.length >= max) return
                next = cur + chr
            }
            if (focusField === "date") mDate = next; else mTime = next
            modal.requestDraw()
        },
        draw: (ctx, g) => {
            const now = new Date()
            const x = g.X + 18, w = g.w - 36
            const y0 = g.Y + GHEAD + 8
            holoPane(ctx, g.X, g.Y, g.w, g.h)
            gtxt(ctx, g.X + 24, g.Y + 28, "SYSTEM TIME", GTITLE, 15, YEL, 0.98, 1, 0.5)
            ctx.setSourceRGBA(HOT[0], HOT[1], HOT[2], 0.45); ctx.setLineWidth(1)
            ctx.newPath(); ctx.moveTo(g.X + 16, g.Y + GHEAD); ctx.lineTo(g.X + g.w - 16, g.Y + GHEAD); ctx.stroke()

            chamfer(ctx, x, y0, w, 96, 14)
            ctx.setSourceRGBA(ARA[0] * 0.24, ARA[1] * 0.34, ARA[2] * 0.44, 0.18); ctx.fill()
            hatch(ctx, x + w - 68, y0, 68, 26, ARA, 0.1)
            chamfer(ctx, x, y0, w, 96, 14)
            ctx.setSourceRGBA(ARA[0], ARA[1], ARA[2], 0.45); ctx.setLineWidth(1); ctx.stroke()
            bracket(ctx, x + 5, y0 + 5, w - 10, 86, YEL, 0.5)

            const clock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
            ctx.selectFontFace(GTITLE, 0, 1); ctx.setFontSize(54)
            const clkW = Math.max(140, ctx.textExtents(clock).width)
            ghost(ctx, x + 20, y0 + 66, clock, GTITLE, 54, 0.42)
            gpango(ctx, x + 20, y0 + 66, clock, GTITLE, true, 54, YEL, 0.98)
            gpango(ctx, x + 20 + clkW + 14, y0 + 66, pad2(now.getSeconds()), GTITLE, true, 22, AC2, now.getMilliseconds() < 500 ? 0.95 : 0.45)
            const rc = x + 240
            gtxt(ctx, rc, y0 + 26, `${WD[now.getDay()]} ${now.getDate()} ${MON3[now.getMonth()]} ${now.getFullYear()}`, GTITLE, 12, YEL, 0.95, 1, 0.3)
            gtxt(ctx, rc, y0 + 48, `ZONE ${curZone}`, GMONO, 9.5, AC2, 0.8)
            gtxt(ctx, rc, y0 + 65, `RTC ${rtc}`, GMONO, 8, ARA, 0.5)
            gtxt(ctx, rc, y0 + 84, ntp ? "// NET SYNC ACTIVE" : "// MANUAL CLOCK", GMONO, 8.5, ntp ? YEL : HOT, 0.9)

            const cy = y0 + 108, cw = (w - 20) / 5, chh = 28
            chip(ctx, g, x, cy, cw - 5, chh, ntp ? "SYNC ON" : "SYNC OFF", ntp, () => setNtp(!ntp))
            chip(ctx, g, x + cw, cy, cw - 5, chh, "−1 H", false, () => nudge(-60))
            chip(ctx, g, x + cw * 2, cy, cw - 5, chh, "−1 M", false, () => nudge(-1))
            chip(ctx, g, x + cw * 3, cy, cw - 5, chh, "+1 M", false, () => nudge(1))
            chip(ctx, g, x + cw * 4, cy, cw - 5, chh, "+1 H", false, () => nudge(60))

            const my = cy + chh + 42
            gtxt(ctx, x, my - 26, "// MANUAL OVERRIDE", GMONO, 8.5, ntp ? ARA : YEL, ntp ? 0.35 : 0.75)
            const fh = 30, dw = w * 0.42, tw = w * 0.3, aw = w - dw - tw - 16
            field(ctx, g, x, my, dw, fh, "DATE", mDate, "date", "YYYY-MM-DD")
            field(ctx, g, x + dw + 8, my, tw, fh, "TIME", mTime, "time", "HH:MM:SS")
            chip(ctx, g, x + dw + tw + 16, my, aw, fh, "APPLY", false, applyManual, ntp ? ARA : YEL)

            const by = my + fh + 22, bh = 28
            chamfer(ctx, x, by, w, bh, 7)
            ctx.setSourceRGBA(ARA[0] * 0.2, ARA[1] * 0.3, ARA[2] * 0.4, 0.34); ctx.fill()
            chamfer(ctx, x, by, w, bh, 7)
            ctx.setSourceRGBA(ARA[0], ARA[1], ARA[2], focusField === "filter" ? 0.9 : 0.45); ctx.setLineWidth(0.9); ctx.stroke()
            const fcur = focusField === "filter" && (Math.floor(Date.now() / 450) % 2) ? "▌" : ""
            gpango(ctx, x + 14, by + bh / 2 + 5, query ? query + fcur : "Filter timezones…", GTITLE, false, 12, query ? AC2 : ARA, query ? 0.96 : 0.4)
            gtxt(ctx, x + w - ctx.textExtents(hint).width - 12, by + bh / 2 + 4, hint, GMONO, 8.5, ARA, 0.5)
            if (!authOpen) g.push({ kind: "field", bx0: x, by0: by, bx1: x + w, by1: by + bh, on: () => { focusField = "filter"; modal.requestDraw() } })

            const ly = by + bh + 14, lh = (g.Y + g.h) - ly - 26, rowH = 24, gap = 4, step = rowH + gap
            const vis = Math.max(1, Math.floor(lh / step))
            const maxS = Math.max(0, results.length - vis), sc = Math.min(scroll, maxS)
            ctx.save(); ctx.rectangle(x - 2, ly - 2, w + 4, lh + 4); ctx.clip()
            for (let i = 0; i <= vis; i++) {
                const idx = sc + i; if (idx >= results.length) break
                const z = results[idx], ry = ly + i * step; if (ry + rowH > ly + lh + step) break
                const active = z === curZone
                chamfer(ctx, x, ry, w, rowH, 6)
                ctx.setSourceRGBA(ARA[0] * 0.24, ARA[1] * 0.34, ARA[2] * 0.44, active ? 0.3 : 0.12); ctx.fill()
                if (active) {
                    chamfer(ctx, x, ry, w, rowH, 6)
                    ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.85); ctx.setLineWidth(1.2); ctx.stroke()
                    ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.9); ctx.rectangle(x, ry, 3, rowH); ctx.fill()
                }
                gpango(ctx, x + 14, ry + rowH / 2 + 4, z, GTITLE, active, 11, active ? YEL : AC2, active ? 0.98 : 0.82)
                let tzn = ""
                try { tzn = new Date().toLocaleTimeString("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit" }) } catch {}
                ctx.selectFontFace(GMONO, 0, 0); ctx.setFontSize(9)
                gtxt(ctx, x + w - ctx.textExtents(tzn).width - 12, ry + rowH / 2 + 4, tzn, GMONO, 9, active ? YEL : ARA, 0.65)
                if (!authOpen) g.push({ kind: "zone", bx0: x, by0: ry, bx1: x + w, by1: ry + rowH, on: () => setZone(z) })
            }
            ctx.restore()
            const live = status && Date.now() < statusUntil
            gtxt(ctx, x, g.Y + g.h - 10, live ? status : "TAB switches field · type · click a zone · ESC closes", GMONO, 8.5, live ? YEL : ARA, live ? 0.9 : 0.5)

            if (authOpen) {
                ctx.setSourceRGBA(0, 0, 0, 0.72); ctx.rectangle(g.X, g.Y, g.w, g.h); ctx.fill()
                const aw = w - 40, ah = 190, ax = x + 20, ay = g.Y + (g.h - ah) / 2
                chamfer(ctx, ax, ay, aw, ah, 16)
                ctx.setSourceRGBA(HOT[0] * 0.3, HOT[1] * 0.12, HOT[2] * 0.14, 0.9); ctx.fill()
                hatch(ctx, ax, ay, aw, 30, HOT, 0.16)
                chamfer(ctx, ax, ay, aw, ah, 16)
                ctx.setSourceRGBA(HOT[0], HOT[1], HOT[2], 0.95); ctx.setLineWidth(1.6); ctx.stroke()
                bracket(ctx, ax + 6, ay + 6, aw - 12, ah - 12, YEL, 0.7, 12)
                ctx.setSourceRGBA(HOT[0], HOT[1], HOT[2], 0.9); ctx.rectangle(ax, ay, aw, 3); ctx.fill()
                gtxt(ctx, ax + 18, ay + 30, "// BREACH PROTOCOL — ROOT ACCESS", GMONO, 9, YEL, 0.85)
                gtxt(ctx, ax + 18, ay + 52, authMsg, GTITLE, 13, authMsg.indexOf("DENIED") >= 0 ? HOT : AC2, 0.98, 1, 0.3)
                const px = ax + 18, py = ay + 66, pw = aw - 36, ph = 34
                chamfer(ctx, px, py, pw, ph, 8)
                ctx.setSourceRGBA(0, 0, 0, 0.6); ctx.fill()
                chamfer(ctx, px, py, pw, ph, 8)
                ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.8); ctx.setLineWidth(1.1); ctx.stroke()
                const dots = "▮".repeat(Math.min(28, authPw.length))
                const cur = (Math.floor(Date.now() / 420) % 2) && !authBusy ? "▌" : ""
                gpango(ctx, px + 12, py + ph / 2 + 5, dots + cur || (authBusy ? "…" : "PASSCODE"), GTITLE, true, 13, authPw ? YEL : ARA, authPw ? 0.95 : 0.35)
                gtxt(ctx, px, py + ph + 18, `CMD  timedatectl ${(authArgs || []).join(" ")}`.slice(0, 58), GMONO, 8, ARA, 0.5)
                const bw = (pw - 10) / 2, byy = py + ph + 30
                drawingAuth = true
                chip(ctx, g, px, byy, bw, 30, authBusy ? "…" : "AUTHORIZE", !authBusy, () => submitAuth(), YEL)
                chip(ctx, g, px + bw + 10, byy, bw, 30, "CANCEL", false, cancelAuth, HOT)
                drawingAuth = false
            }
        },
    })
}

export const openTimeModal = () => { ensure(); modal.toggle() }
