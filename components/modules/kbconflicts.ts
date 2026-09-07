import { execAsync } from "astal"
import { CYBER_DIR } from "../../env.ts"
import { createModal, drawBtn, registerCModal } from "./cmodal.ts"
import { txt as gtxt, CYAN as GCYAN, ACC as GACC, HEADER as GHEAD, TITLE as GTITLE, MONO as GMONO } from "./glass.ts"

export type KbConflict = { combo: string, where: string, theme: string, label: string }

let modal: any = null
let conflicts: KbConflict[] = []
let scroll = 0
let resolving = false
let status = ""
let statusUntil = 0

const say = (s: string) => { status = s; statusUntil = Date.now() + 5000; modal?.requestDraw() }

const prettyCombo = (c: string) => c.split("+").filter(Boolean).join(" + ").toUpperCase()

const ensure = () => {
    if (modal) return
    modal = createModal({
        name: "kbconflicts", tabTitle: "KEYBIND CONFLICTS", W: 560, H: 460, hud: true,
        onOpen: () => { scroll = 0 },
        onScroll: (d: number) => {
            scroll = Math.max(0, Math.min(Math.max(0, conflicts.length - 1), scroll + d))
            modal.requestDraw()
        },
        draw: (ctx: any, g: any) => {
            const x = g.X + 44, w = g.w - 68
            let cy = g.Y + GHEAD + 40
            gtxt(ctx, x, cy, "KEYBIND CONFLICTS DETECTED!", GTITLE, 17, GCYAN, 1, 1, 0.5)
            gtxt(ctx, x, cy + 20, `// ${conflicts.length} user bind${conflicts.length === 1 ? "" : "s"} overlap the theme`, GMONO, 9, GACC, 0.75)
            cy += 38

            const btnH = 36
            const listBottom = g.Y + g.h - 48 - btnH - 18
            const rowH = 44
            const vis = Math.max(1, Math.floor((listBottom - cy) / rowH))
            ctx.save()
            ctx.rectangle(x - 2, cy - 2, w + 4, listBottom - cy + 4); ctx.clip()
            for (let i = 0; i < vis; i++) {
                const idx = scroll + i
                if (idx >= conflicts.length) break
                const c = conflicts[idx]
                const ry = cy + i * rowH
                ctx.setSourceRGBA(GCYAN[0], GCYAN[1], GCYAN[2], 0.08); ctx.rectangle(x, ry, w, rowH - 8); ctx.fill()
                ctx.setSourceRGBA(GCYAN[0], GCYAN[1], GCYAN[2], 0.3); ctx.setLineWidth(0.8); ctx.rectangle(x, ry, w, rowH - 8); ctx.stroke()
                gtxt(ctx, x + 12, ry + 16, prettyCombo(c.combo), GTITLE, 11, GCYAN, 0.98, 1)
                const act = c.label ? ` FOR ${c.label}` : ""
                gtxt(ctx, x + 12, ry + 30, `CONFLICT AT ${c.where}  |::|  THEME USES ${c.theme}${act}`, GMONO, 8, GACC, 0.7)
            }
            ctx.restore()
            if (conflicts.length > vis) {
                gtxt(ctx, x, g.Y + g.h - 60, `${scroll + 1}-${Math.min(scroll + vis, conflicts.length)} of ${conflicts.length} · scroll for more`, GMONO, 8, GACC, 0.5)
            }

            const by = g.Y + g.h - 44 - btnH, gap = 12, hbw = (w - gap) / 2
            if (resolving) {
                gtxt(ctx, x, by + btnH / 2, "RESOLVING — COMMENTING OUT CONFLICTS …", GMONO, 10, GCYAN, 0.9)
            } else {
                drawBtn(ctx, g.push, x, by, hbw, btnH, "RESOLVE CONFLICTS", () => {
                    resolving = true; modal.requestDraw()
                    execAsync(["sh", "-c", `'${CYBER_DIR}/scripts/kbconflicts' --fix`])
                        .then(() => { resolving = false; say("CONFLICTS COMMENTED OUT · RELOADING"); modal.close() })
                        .catch(() => { resolving = false; say("RESOLVE FAILED — SEE ~/.config/hypr BACKUPS") })
                }, true, GCYAN)
                drawBtn(ctx, g.push, x + hbw + gap, by, hbw, btnH, "CANCEL", () => modal.close(), false, GCYAN)
            }

            const live = status && Date.now() < statusUntil
            if (live) gtxt(ctx, x, g.Y + g.h - 12, status, GMONO, 8.5, GCYAN, 0.9)
        },
    })
    registerCModal(modal)
}

export const openKbConflictsModal = (request: string) => {
    // payload: "kbconflicts <n>;<combo> <file:line> :: <theme_src>;…"
    const body = request.slice("kbconflicts".length).trim()
    const parts = body.split(";").filter((s) => s.trim().length)
    const count = parts.length ? parseInt(parts[0].trim(), 10) || 0 : 0
    conflicts = parts.slice(1).map((p) => {
        const m = p.trim().match(/^(\S+)\s+(\S+)\s*::\s*(\S+)(?:\s*::\s*(.*))?$/)
        if (!m) return { combo: p.trim(), where: "?", theme: "?", label: "" }
        return { combo: m[1], where: m[2], theme: m[3], label: (m[4] || "").trim() }
    }).filter((c) => c.where !== "?")
    if (!conflicts.length) return
    scroll = 0
    ensure()
    modal.open()
    modal.requestDraw()
}
