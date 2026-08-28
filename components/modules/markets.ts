import { Box, DrawingArea, EventBox } from "./widget.ts"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import { interval, execAsync } from "astal"
import { CYBER_DIR } from "../../env.ts"
import { makePlane, tiltText, fillQuad, strokePath } from "./proj.ts"
import { NEON, USER, onColorChange } from "./colors.ts"
import { createModal } from "./cmodal.ts"
import { txt as gtxt, pango as gpango, RED, RACC, HEADER as GHEAD, TITLE as GTITLE, MONO as GMONO, pip, projQuad, CYAN, ACC } from "./glass.ts"
import { TITLE, MONO, ENIXE, FROSTBITE_WIDE, GUNSHIP_ITAL } from "./fonts.ts"

const Cairo = (imports as any).cairo

const UP: [number, number, number] = [80 / 255, 240 / 255, 150 / 255]
const DOWN: [number, number, number] = [255 / 255, 70 / 255, 84 / 255]
const UP_RGB: [number, number, number] = [80, 240, 150]
const DOWN_RGB: [number, number, number] = [255, 70, 84]
const YEL: [number, number, number] = USER.amber
const DIMC: [number, number, number] = USER.dim

const STORE = `${CYBER_DIR}/markets.json`
const MAXPIN = 5
const BROWSE_CHUNK = 20
const NEWS_CHUNK = 10
const NEWS_BATCH_QUERIES = [
    ["top stories when:1d", "breaking news when:1d", "world news when:1d"],
    ["business markets economy when:1d", "technology cyber security when:1d", "science health when:1d"],
    ["europe news when:1d", "americas news when:1d", "asia news when:1d"],
    ["politics diplomacy conflict when:1d", "climate energy transport when:1d", "finance companies when:1d"],
    ["security crime cities when:1d", "ai chips software when:1d", "crypto stocks markets when:1d"],
    ["global headlines when:2d", "latest international news when:2d", "major world events when:2d"],
    ["economic outlook when:2d", "technology regulation when:2d", "public safety when:2d"],
    ["europe economy technology when:2d", "world business headlines when:2d", "science discoveries when:2d"],
]
const EXTRA_NEWS_FEEDS = [
    { feed: "BBC WORLD", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "GLOBAL" },
    { feed: "BBC BUSINESS", url: "https://feeds.bbci.co.uk/news/business/rss.xml", region: "GLOBAL" },
    { feed: "BBC TECH", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", region: "GLOBAL" },
    { feed: "BBC SCIENCE", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", region: "GLOBAL" },
    { feed: "GUARDIAN WORLD", url: "https://www.theguardian.com/world/rss", region: "GLOBAL" },
    { feed: "GUARDIAN BUSINESS", url: "https://www.theguardian.com/uk/business/rss", region: "GLOBAL" },
    { feed: "GUARDIAN TECH", url: "https://www.theguardian.com/technology/rss", region: "GLOBAL" },
    { feed: "GUARDIAN SCIENCE", url: "https://www.theguardian.com/science/rss", region: "GLOBAL" },
    { feed: "AL JAZEERA", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "GLOBAL" },
    { feed: "NPR NEWS", url: "https://feeds.npr.org/1001/rss.xml", region: "GLOBAL" },
    { feed: "SKY NEWS", url: "https://feeds.skynews.com/feeds/rss/world.xml", region: "GLOBAL" },
    { feed: "DW NEWS", url: "https://rss.dw.com/rdf/rss-en-all", region: "GLOBAL" },
    { feed: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", region: "GLOBAL" },
    { feed: "NYT WORLD", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", region: "GLOBAL" },
    { feed: "TECHCRUNCH", url: "https://techcrunch.com/feed/", region: "GLOBAL" },
    { feed: "THE VERGE", url: "https://www.theverge.com/rss/index.xml", region: "GLOBAL" },
]
const EXTRA_FEEDS_PER_PAGE = 4
const MARKET_PLANE = makePlane({ w: 320, h: 196, yaw: 22, pitch: -8, roll: 4, focal: 4600, dist: 4200, pad: 18 })
const CRYPTO_SYM: Record<string, string> = {
    bitcoin: "BTC",
    ethereum: "ETH",
    solana: "SOL",
    binancecoin: "BNB",
    ripple: "XRP",
    monero: "XMR",
    tether: "USDT",
    "usd-coin": "USDC",
    tron: "TRX",
    dogecoin: "DOGE",
    cardano: "ADA",
    "venice-token": "VENICE",
}
const GLOBAL_FEEDS = [
    { feed: "REUTERS", url: "https://feeds.reuters.com/reuters/topNews" },
    { feed: "REUTERS WORLD", url: "https://feeds.reuters.com/reuters/worldNews" },
    { feed: "BBC WORLD", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { feed: "GUARDIAN WORLD", url: "https://www.theguardian.com/world/rss" },
]

let pins: any = { stocks: ["NVDA", "SPCX", "SNDK", "INTC", "MU"], crypto: ["bitcoin", "ethereum", "solana", "monero", "venice-token"] }
let tab = "crypto"
let quotes: any = {}
let areas: any[] = []
let mkModal: any = null
onColorChange(() => areas.forEach(a => a?.queue_draw()))
let mQuery = ""
let mResults: any[] = []
let mHint = "TYPE TO SEARCH"
let mScroll = 0
let browse: any = { stocks: [], crypto: [] }
let browsePage: any = { stocks: 0, crypto: 0 }
let browseMore: any = { stocks: true, crypto: true }
let browseBusy: any = { stocks: false, crypto: false }
let hoverTab = ""
let hoverAnim: any = { stocks: 0, crypto: 0, news: 0 }
let searchTimer: number | null = null
let marketSel: any = { stocks: "", crypto: "" }
let newsRows: any[] = []
let newsAllRows: any[] = []
let newsPage = 0
let newsHasMore = true
let newsSel = ""
let newsScroll = 0
let newsBusy = false
let newsHint = "GLOBAL / LOCAL FEEDS"
let newsCity = "LOCAL"
let newsUpdated = 0
const pendingSeries = new Set<string>()
const ICONS: any = {}
const DEFAULT_MARKETS: Record<string, any[]> = {
    stocks: [
        { id: "UBER", sym: "UBER", name: "Uber Technologies, Inc." },
        { id: "NVDA", sym: "NVDA", name: "NVIDIA Corporation" },
        { id: "AAPL", sym: "AAPL", name: "Apple Inc." },
        { id: "TSLA", sym: "TSLA", name: "Tesla, Inc." },
        { id: "INTC", sym: "INTC", name: "Intel Corporation" },
        { id: "SMCI", sym: "SMCI", name: "Super Micro Computer, Inc." },
        { id: "SPCX", sym: "SPCX", name: "Space Exploration Technologies" },
        { id: "PLUG", sym: "PLUG", name: "Plug Power, Inc." },
        { id: "CRWV", sym: "CRWV", name: "CoreWeave, Inc." },
        { id: "ONDS", sym: "ONDS", name: "Ondas Holdings Inc." },
    ],
    crypto: [
        { id: "bitcoin", sym: "BTC", name: "Bitcoin" },
        { id: "ethereum", sym: "ETH", name: "Ethereum" },
        { id: "solana", sym: "SOL", name: "Solana" },
        { id: "binancecoin", sym: "BNB", name: "Binance Coin" },
        { id: "ripple", sym: "XRP", name: "XRP" },
        { id: "tether", sym: "USDT", name: "Tether" },
        { id: "usd-coin", sym: "USDC", name: "USD Coin" },
        { id: "tron", sym: "TRX", name: "TRON" },
        { id: "dogecoin", sym: "DOGE", name: "Dogecoin" },
        { id: "cardano", sym: "ADA", name: "Cardano" },
    ],
}

const redraw = () => areas.forEach((a) => a?.queue_draw())

const loadPins = () => {
    try {
        const [ok, data] = GLib.file_get_contents(STORE)
        if (ok) {
            const o = JSON.parse(new TextDecoder().decode(data))
            if (Array.isArray(o.stocks)) pins.stocks = o.stocks.slice(0, MAXPIN)
            if (Array.isArray(o.crypto)) pins.crypto = o.crypto.slice(0, MAXPIN)
        }
    } catch { }
}

const savePins = () => {
    try { GLib.file_set_contents(STORE, new TextEncoder().encode(JSON.stringify(pins))) }
    catch (e) { print("[cyber] markets save:", e) }
}

const curl = (url: string) => execAsync(["curl", "-sfL", "--max-time", "10", "-H", "User-Agent: Mozilla/5.0", url])
const openUrl = (url: string) => execAsync(["xdg-open", url]).catch((e) => print("[cyber] open url:", e))

const decodeHtml = (s: string) => String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&rsquo;/gi, "'").replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"').replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, "-").replace(/&mdash;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_m, d) => String.fromCharCode(parseInt(d, 10)))

const clean = (s: string) => decodeHtml(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
const trunc = (s: string, n: number) => {
    const t = clean(s)
    return t.length > n ? `${t.slice(0, Math.max(0, n - 1))}…` : t
}
const first = (s: string, re: RegExp) => {
    const m = s.match(re)
    return m ? clean(m[1]) : ""
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const priceFmt = (v: number) => {
    if (v == null || isNaN(v)) return "--"
    if (v >= 1000) return v.toFixed(0)
    if (v >= 1) return v.toFixed(2)
    return v.toFixed(4)
}
const usdFmt = (v: number) => {
    if (v == null || isNaN(v)) return "--"
    if (v >= 1) return v.toFixed(2)
    return v.toFixed(4)
}
const chgFmt = (c: number) => `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`
const relTime = (ts: number) => {
    if (!ts) return "--"
    const mins = Math.max(1, Math.round((Date.now() - ts) / 60000))
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
}

const sameDay = (a: number, b = Date.now()) => {
    if (!a) return false
    const da = new Date(a)
    const db = new Date(b)
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

const readCity = () => {
    try {
        const [ok, data] = GLib.file_get_contents(`${CYBER_DIR}/config/city.json`)
        if (ok) {
            const o = JSON.parse(new TextDecoder().decode(data))
            return {
                name: String(o.name || "LOCAL").trim(),
                full: String(o.full || o.name || "LOCAL").trim(),
            }
        }
    } catch { }
    return { name: "LOCAL", full: "LOCAL" }
}

const countryCode = (full: string) => {
    const txt = String(full || "").toUpperCase()
    const map: any = {
        "UNITED STATES": "US",
        "UNITED KINGDOM": "GB",
        "ENGLAND": "GB",
        "SCOTLAND": "GB",
        "WALES": "GB",
        "NORTHERN IRELAND": "GB",
        "PORTUGAL": "PT",
        "FRANCE": "FR",
        "GERMANY": "DE",
        "SPAIN": "ES",
        "ITALY": "IT",
        "CANADA": "CA",
        "AUSTRALIA": "AU",
        "IRELAND": "IE",
        "NETHERLANDS": "NL",
        "BELGIUM": "BE",
        "SWEDEN": "SE",
        "NORWAY": "NO",
        "FINLAND": "FI",
        "DENMARK": "DK",
        "POLAND": "PL",
        "SWITZERLAND": "CH",
        "AUSTRIA": "AT",
    }
    for (const [k, v] of Object.entries(map)) if (txt.includes(k)) return v
    return "US"
}

const numFmt = (n: any) => {
    const v = Number(n)
    if (!isFinite(v) || v === 0) return "--"
    const a = Math.abs(v)
    if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`
    if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`
    if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K`
    return a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : v.toFixed(4)
}

const cutPath = (ctx: any, bx: number, by: number, bw: number, bh: number, c = 6) => {
    ctx.newPath()
    ctx.moveTo(bx + c, by)
    ctx.lineTo(bx + bw, by)
    ctx.lineTo(bx + bw, by + bh - c)
    ctx.lineTo(bx + bw - c, by + bh)
    ctx.lineTo(bx, by + bh)
    ctx.lineTo(bx, by + c)
    ctx.closePath()
}

const tabPath = (ctx: any, bx: number, by: number, bw: number, bh: number) => {
    const c = 8
    const n = Math.min(36, Math.max(22, bw * 0.28))
    ctx.newPath()
    ctx.moveTo(bx, by + 2)
    ctx.lineTo(bx + n, by + 2)
    ctx.lineTo(bx + n + 7, by)
    ctx.lineTo(bx + bw, by)
    ctx.lineTo(bx + bw, by + bh - c)
    ctx.lineTo(bx + bw - 10, by + bh)
    ctx.lineTo(bx + 5, by + bh)
    ctx.lineTo(bx, by + bh - 5)
    ctx.closePath()
}

const logoutPath = (ctx: any, bx: number, by: number, bw: number, bh: number) => {
    const c = 7
    ctx.newPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + bw - c, by)
    ctx.lineTo(bx + bw, by + c)
    ctx.lineTo(bx + bw, by + bh)
    ctx.lineTo(bx + c, by + bh)
    ctx.lineTo(bx, by + bh - c)
    ctx.closePath()
}

const marketRowPath = (ctx: any, bx: number, by: number, bw: number, bh: number) => {
    const br = 12
    const nx = 3
    const nt = Math.round(bh * 0.43)
    const nb = Math.round(bh * 0.57)
    const step = Math.round(bw * 0.46)
    ctx.newPath()
    ctx.moveTo(bx, by + 1)
    ctx.lineTo(bx + step, by + 1)
    ctx.lineTo(bx + step + 10, by)
    ctx.lineTo(bx + bw, by)
    ctx.lineTo(bx + bw, by + bh - br)
    ctx.lineTo(bx + bw - br, by + bh)
    ctx.lineTo(bx + 1, by + bh)
    ctx.lineTo(bx + 1, by + nb + 1)
    ctx.lineTo(bx + nx, by + nb)
    ctx.lineTo(bx + nx, by + nt)
    ctx.lineTo(bx + 1, by + nt - 1)
    ctx.lineTo(bx + 1, by + 1)
    ctx.closePath()
}

const textWidth = (ctx: any, text: string, font: string, size: number, bold = 0) => {
    ctx.save()
    ctx.selectFontFace(font, 0, bold)
    ctx.setFontSize(size)
    const w = ctx.textExtents(text).width
    ctx.restore()
    return w
}

const drawMetricCell = (ctx: any, x: number, y: number, w: number, h: number, label: string, value: string, col: any) => {
    cutPath(ctx, x, y, w, h, 5)
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.06)
    ctx.fill()
    cutPath(ctx, x, y, w, h, 5)
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.22)
    ctx.setLineWidth(1)
    ctx.stroke()
    gtxt(ctx, x + 9, y + 13, label, GMONO, 7.5, RACC, 0.55)
    gtxt(ctx, x + 9, y + h - 9, value, GTITLE, 11, ACC, 0.95, 1)
}

const icon = (name: string) => {
    try {
        if (ICONS[name] === undefined) ICONS[name] = Cairo.ImageSurface.createFromPNG(`${CYBER_DIR}/assets/icons/${name}`)
    } catch { ICONS[name] = null }
    return ICONS[name]
}

const drawIcon = (ctx: any, name: string, x: number, y: number, w: number, h: number, a = 1) => {
    const surf = icon(name)
    if (!surf) return
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(w / surf.getWidth(), h / surf.getHeight())
    ctx.setSourceSurface(surf, 0, 0)
    ctx.paintWithAlpha(a)
    ctx.restore()
}

const drawScrollbar = (ctx: any, x: number, y: number, h: number, total: number, vis: number, scroll: number, col: any) => {
    if (total <= vis) return
    const railW = 5
    const railY = y + 2
    const railH = Math.max(1, h - 4)
    const thumbH = clamp(railH * (vis / total), 28, railH)
    const maxS = Math.max(1, total - vis)
    const ty = railY + (railH - thumbH) * clamp(scroll / maxS, 0, 1)
    ctx.setSourceRGBA(0.01, 0.04, 0.05, 0.72)
    ctx.rectangle(x, railY, railW, railH)
    ctx.fill()
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.22)
    ctx.rectangle(x, railY, railW, railH)
    ctx.setLineWidth(1)
    ctx.stroke()
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.14)
    ctx.rectangle(x + 1, railY + 5, railW - 2, railH - 10)
    ctx.fill()
    cutPath(ctx, x - 1, ty, railW + 2, thumbH, 2)
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.22)
    ctx.fill()
    cutPath(ctx, x - 1, ty, railW + 2, thumbH, 2)
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.86)
    ctx.setLineWidth(1)
    ctx.stroke()
    ctx.setSourceRGBA(1, 1, 1, 0.24)
    ctx.rectangle(x + 2, ty + 4, 1, Math.max(3, thumbH - 8))
    ctx.fill()
}

const isAggregatorFeed = (feed: string) => /^google|^local/i.test(feed)

const parseFeed = (xml: string, feed: string, region: string) => {
    const out: any[] = []
    const aggregator = isAggregatorFeed(feed)
    const matches = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || []
    matches.forEach((item, idx) => {
        const title = first(item, /<title[^>]*>([\s\S]*?)<\/title>/i)
        const link = first(item, /<link[^>]*href="([^"]+)"/i) || first(item, /<link[^>]*>([\s\S]*?)<\/link>/i) || first(item, /<guid[^>]*>([\s\S]*?)<\/guid>/i)
        if (!link || !title) return
        const rawSummary = aggregator ? "" : (first(item, /<description[^>]*>([\s\S]*?)<\/description>/i)
            || first(item, /<summary[^>]*>([\s\S]*?)<\/summary>/i)
            || first(item, /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i))
        const titleNorm = clean(title).toLowerCase()
        const summary = clean(rawSummary).toLowerCase().startsWith(titleNorm.slice(0, 24)) ? "" : rawSummary
        const source = first(item, /<source[^>]*>([\s\S]*?)<\/source>/i) || feed
        const published = first(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
            || first(item, /<updated[^>]*>([\s\S]*?)<\/updated>/i)
            || first(item, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)
        const ts = Date.parse(published)
        out.push({
            id: `${feed}:${idx}:${link}`,
            title: clean(title),
            source: clean(source) || feed,
            url: link,
            summary: clean(summary),
            region,
            published: clean(published),
            ts: Number.isFinite(ts) ? ts : 0,
            feed,
        })
    })
    return out
}

const fetchFeed = async (url: string, feed: string, region: string) => {
    try { return parseFeed(await curl(url), feed, region) }
    catch (e) { print("[cyber] news feed:", feed, e); return [] }
}

const buildLocalNewsUrl = (name: string, full: string) => {
    const q = encodeURIComponent(`${full || name || "LOCAL"} when:7d`)
    const cc = countryCode(full || name)
    return `https://news.google.com/rss/search?q=${q}&hl=en-${cc}&gl=${cc}&ceid=${cc}:en`
}

const buildGoogleNewsUrl = (query: string, cc = "US") => {
    const code = cc || "US"
    return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-${code}&gl=${code}&ceid=${code}:en`
}

const newsFeedsForPage = (city: any, page: number) => {
    const cc = countryCode(city.full || city.name || "")
    const days = Math.min(30, 1 + Math.floor(page / NEWS_BATCH_QUERIES.length))
    const queries = NEWS_BATCH_QUERIES[page % NEWS_BATCH_QUERIES.length] || NEWS_BATCH_QUERIES[0]
    const extraStart = (page * EXTRA_FEEDS_PER_PAGE) % EXTRA_NEWS_FEEDS.length
    const extra: any[] = []
    for (let i = 0; i < EXTRA_FEEDS_PER_PAGE; i++)
        extra.push(EXTRA_NEWS_FEEDS[(extraStart + i) % EXTRA_NEWS_FEEDS.length])
    const cityName = city.name || "LOCAL"
    const cityFull = city.full || cityName
    const localQuery = page % 2 === 0 ? `${cityFull} news when:${Math.max(7, days)}d` : `${cityName} breaking local news when:${Math.max(7, days)}d`
    return [
        ...queries.map((q, i) => {
            const query = `${q.replace(/\s+when:\d+d/g, "")} when:${days}d`
            return { feed: `GOOGLE ${page + 1}.${i + 1}`, url: buildGoogleNewsUrl(query, cc), region: "GLOBAL" }
        }),
        ...extra,
        { feed: `LOCAL ${cityName}`, url: buildGoogleNewsUrl(localQuery, cc), region: cityFull },
    ]
}

const pushHist = (key: string, v: number) => {
    const q = quotes[key]
    if (!q) return
    if (!q.hist) q.hist = []
    if (q.hist.length === 0 || Math.abs(q.hist[q.hist.length - 1] - v) > 1e-9) q.hist.push(v)
    if (q.hist.length > 40) q.hist.shift()
}

const fetchCryptoHistory = async (id: string) => {
    const key = `c:${id}`
    if (pendingSeries.has(key)) return
    pendingSeries.add(key)
    try {
        const j = JSON.parse(await curl(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=1&interval=hourly`))
        const prices = (j?.prices || []).filter((p: any) => Array.isArray(p) && p.length >= 2)
        const hist = prices.map((p: any) => Number(p[1])).filter((v: number) => isFinite(v))
        const histTs = prices.map((p: any) => Number(p[0])).filter((v: number) => isFinite(v))
        const last = hist.length ? hist[hist.length - 1] : NaN
        const first = hist.length ? hist[0] : NaN
        const chg = first > 0 && isFinite(first) && isFinite(last) ? ((last - first) / first) * 100 : 0
        const name = quotes[key]?.name || id
        setSeries(key, last || 0, chg, name, cryptoSym(id), hist, histTs)
        redraw(); mkModal?.requestDraw()
    } catch (e) { print("[cyber] crypto:", e) }
    finally { pendingSeries.delete(key) }
}

const fetchCrypto = async () => {
    const ids = pins.crypto.filter(Boolean)
    if (!ids.length) return
    try {
        const joined = ids.map((id: string) => encodeURIComponent(id)).join(",")
        const j = JSON.parse(await curl(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${joined}&order=market_cap_desc&per_page=${ids.length}&page=1&sparkline=false`))
        for (const c of j || []) {
            const key = `c:${c.id}`
            quotes[key] = quotes[key] || { hist: [] }
            quotes[key].sym = (c.symbol || cryptoSym(c.id)).toUpperCase()
            quotes[key].name = c.name || c.id
            quotes[key].price = c.current_price
            quotes[key].chg = c.price_change_percentage_24h ?? 0
            quotes[key].meta = {
                market_cap_rank: c.market_cap_rank,
                market_cap: c.market_cap,
                total_volume: c.total_volume,
                circulating_supply: c.circulating_supply,
                high_24h: c.high_24h,
                low_24h: c.low_24h,
                ath: c.ath,
                atl: c.atl,
            }
        }
        redraw(); mkModal?.requestDraw()
    } catch (e) { print("[cyber] crypto list:", e) }
    for (const id of ids) await fetchCryptoHistory(id).catch(() => { })
}

const fetchStockHistory = async (sym: string) => {
    const key = `s:${sym}`
    if (pendingSeries.has(key)) return
    pendingSeries.add(key)
    try {
        const j = JSON.parse(await curl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=5m&range=1d`))
        const r = j?.chart?.result?.[0]
        const m = r?.meta
        if (!m) return
        const closes = (r?.indicators?.quote?.[0]?.close || []).filter((v: any) => typeof v === "number" && isFinite(v))
        const ts = (r?.timestamp || []).filter((v: any) => typeof v === "number" && isFinite(v))
        const last = closes.length ? closes[closes.length - 1] : (m.regularMarketPrice ?? 0)
        const prev = m.chartPreviousClose ?? m.previousClose ?? last
        const chg = prev > 0 ? ((last - prev) / prev) * 100 : 0
        setSeries(key, last, chg, m.shortName || m.longName || sym, m.symbol || sym, closes, ts)
        quotes[key].meta = {
            ...(quotes[key].meta || {}),
            fullExchangeName: m.fullExchangeName,
            exchangeName: m.exchangeName,
            currency: m.currency,
            regularMarketOpen: m.regularMarketOpen,
            regularMarketDayHigh: m.regularMarketDayHigh,
            regularMarketDayLow: m.regularMarketDayLow,
            regularMarketVolume: m.regularMarketVolume,
            fiftyTwoWeekHigh: m.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: m.fiftyTwoWeekLow,
        }
        redraw(); mkModal?.requestDraw()
    } catch (e) { print("[cyber] stock:", e) }
    finally { pendingSeries.delete(key) }
}

const ensureSeries = (kind: string, id: string) => {
    const key = keyOf(kind, id)
    const q = quotes[key]
    if (q && q.hist && q.hist.length > 3) return
    if (kind === "crypto") fetchCryptoHistory(id).catch(() => { })
    else fetchStockHistory(id).catch(() => { })
}

const mergeBrowseRows = (kind: string, rows: any[]) => {
    const seen = new Set<string>()
    const merged: any[] = []
    for (const r of [...(browse[kind] || []), ...rows]) {
        if (!r?.id || seen.has(r.id)) continue
        seen.add(r.id)
        merged.push(r)
    }
    browse[kind] = merged
}

const fetchBrowse = async (kind: string, append = false) => {
    if (browseBusy[kind]) return
    browseBusy[kind] = true
    if (!append) {
        browsePage[kind] = 0
        browseMore[kind] = true
        browse[kind] = []
    }
    const page = browsePage[kind] + 1
    try {
        if (kind === "crypto") {
            const j = JSON.parse(await curl(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${BROWSE_CHUNK}&page=${page}&sparkline=false`))
            const rows = (j || []).map((c: any) => ({ id: c.id, sym: (c.symbol || "").toUpperCase(), name: c.name }))
            mergeBrowseRows("crypto", rows)
            browseMore.crypto = rows.length >= BROWSE_CHUNK
            browsePage.crypto = page
            for (const c of j) {
                const key = `c:${c.id}`
                quotes[key] = quotes[key] || { hist: [] }
                quotes[key].sym = (c.symbol || "").toUpperCase()
                quotes[key].name = c.name
                quotes[key].price = c.current_price
                quotes[key].chg = c.price_change_percentage_24h ?? 0
                quotes[key].meta = {
                    market_cap_rank: c.market_cap_rank,
                    market_cap: c.market_cap,
                    total_volume: c.total_volume,
                    circulating_supply: c.circulating_supply,
                    high_24h: c.high_24h,
                    low_24h: c.low_24h,
                    ath: c.ath,
                    atl: c.atl,
                }
            }
        } else {
            const start = (page - 1) * BROWSE_CHUNK
            const j = JSON.parse(await curl(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=${BROWSE_CHUNK}&start=${start}`))
            const q = j?.finance?.result?.[0]?.quotes || []
            const rows = q.filter((r: any) => r.symbol).map((r: any) => ({ id: r.symbol, sym: r.symbol, name: r.shortName || r.longName || r.symbol }))
            mergeBrowseRows("stocks", rows)
            browseMore.stocks = rows.length >= BROWSE_CHUNK
            browsePage.stocks = page
            for (const r of q) {
                if (!r.symbol) continue
                const key = `s:${r.symbol}`
                quotes[key] = quotes[key] || { hist: [] }
                quotes[key].sym = r.symbol
                quotes[key].name = r.shortName || r.longName || r.symbol
                quotes[key].price = r.regularMarketPrice
                quotes[key].chg = r.regularMarketChangePercent ?? 0
                quotes[key].meta = {
                    fullExchangeName: r.fullExchangeName,
                    exchangeName: r.exchangeName,
                    currency: r.currency,
                    regularMarketVolume: r.regularMarketVolume,
                    regularMarketOpen: r.regularMarketOpen,
                    regularMarketDayHigh: r.regularMarketDayHigh,
                    regularMarketDayLow: r.regularMarketDayLow,
                    fiftyTwoWeekHigh: r.fiftyTwoWeekHigh,
                    fiftyTwoWeekLow: r.fiftyTwoWeekLow,
                }
            }
        }
        mkModal?.requestDraw(); redraw()
    } catch (e) { print("[cyber] browse:", e) }
    finally { browseBusy[kind] = false }
}

const primeBrowse = (kind: string) => {
    if (browse[kind]?.length || browseBusy[kind]) return
    fetchBrowse(kind).catch(() => { })
}

const loadNextBrowse = async (kind: string) => {
    if (browseBusy[kind] || !browseMore[kind]) return
    const before = getMarketRows(kind).length
    await fetchBrowse(kind, true).catch(() => { })
    if (getMarketRows(kind).length > before) mScroll = Math.max(0, before - 1)
    mkModal?.requestDraw()
}

const refreshAll = () => {
    fetchCrypto().catch(() => { })
    for (const s of pins.stocks.filter(Boolean)) fetchStockHistory(s).catch(() => { })
}

const newsKey = (r: any) => clean(String(r?.url || r?.title || "")).replace(/[?#].*$/, "").toLowerCase()

const appendNewsBatch = async (city: any) => {
    let added = 0
    let tries = 0
    const seen = new Set(newsAllRows.map(newsKey).filter(Boolean))
    while (added < NEWS_CHUNK && tries < 5) {
        tries += 1
        const feeds = newsFeedsForPage(city, newsPage)
        newsPage += 1
        const chunks = await Promise.all(feeds.map((f) => fetchFeed(f.url, f.feed, f.region)))
        const merged: any[] = []
        for (const chunk of chunks) for (const row of chunk) merged.push(row)
        const fresh = merged
            .filter((r: any) => {
                const key = newsKey(r)
                if (!key || seen.has(key)) return false
                seen.add(key)
                return true
            })
            .sort((a: any, b: any) => (b.ts || 0) - (a.ts || 0))
            .slice(0, NEWS_CHUNK - added)
        newsAllRows = newsAllRows.concat(fresh).sort((a: any, b: any) => (b.ts || 0) - (a.ts || 0))
        added += fresh.length
    }
    newsRows = newsAllRows
    newsHasMore = true
    return added
}

const refreshNews = async () => {
    if (newsBusy) return
    newsBusy = true
    mkModal?.requestDraw()
    try {
        const city = readCity()
        newsCity = city.full || city.name || "LOCAL"
        newsPage = 0
        newsHasMore = true
        newsRows = []
        newsAllRows = []
        await appendNewsBatch(city)
        newsSel = newsRows.some((r: any) => r.id === newsSel) ? newsSel : (newsRows[0]?.id || "")
        newsUpdated = Date.now()
        newsHint = newsRows.length ? `UPDATED ${new Date(newsUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}  ${newsRows.length} LOADED` : "NO NEWS"
    } catch (e) {
        newsHint = "NEWS FEEDS FAILED"
        print("[cyber] news:", e)
    } finally {
        newsBusy = false
        mkModal?.requestDraw(); redraw()
    }
}

const keyOf = (kind: string, id: string) => `${kind === "crypto" ? "c" : "s"}:${id}`
const isPinned = (kind: string, id: string) => pins[kind].indexOf(id) >= 0
const canPin = (kind: string, id: string) => isPinned(kind, id) || pins[kind].length < MAXPIN
const cryptoSym = (id: string) => CRYPTO_SYM[id] || id.slice(0, 12).toUpperCase()

const setSeries = (key: string, price: number, chg: number, name: string, sym: string, hist: number[] = [], histTs: number[] = []) => {
    quotes[key] = quotes[key] || {}
    quotes[key].sym = sym
    quotes[key].name = name
    quotes[key].price = price
    quotes[key].chg = chg
    quotes[key].hist = hist.filter((v) => typeof v === "number" && isFinite(v))
    quotes[key].histTs = histTs.filter((v) => typeof v === "number" && isFinite(v))
    if (quotes[key].hist.length > 80) quotes[key].hist = quotes[key].hist.slice(-80)
    if (quotes[key].histTs.length > 80) quotes[key].histTs = quotes[key].histTs.slice(-80)
}

const togglePin = (kind: string, id: string) => {
    const i = pins[kind].indexOf(id)
    if (i >= 0) pins[kind].splice(i, 1)
    else {
        if (pins[kind].length >= MAXPIN) return false
        pins[kind].push(id)
    }
    savePins(); refreshAll(); redraw(); mkModal?.requestDraw()
    return true
}

const queueSearch = () => {
    if (searchTimer !== null) GLib.source_remove(searchTimer)
    searchTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 340, () => { searchTimer = null; runSearch().catch(print); return false })
}

const runSearch = async () => {
    if (tab === "news") return
    const q = mQuery.trim()
    if (q.length < 2) { mResults = []; mHint = "TYPE TO SEARCH"; mkModal?.requestDraw(); return }
    mHint = "SEARCHING"; mkModal?.requestDraw()
    try {
        if (tab === "crypto") {
            const j = JSON.parse(await curl(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`))
            mResults = (j.coins || []).slice(0, 80).map((c: any) => ({ id: c.id, sym: (c.symbol || "").toUpperCase(), name: c.name }))
        } else {
            const j = JSON.parse(await curl(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=80&newsCount=0`))
            mResults = (j.quotes || []).filter((r: any) => r.symbol).slice(0, 80)
                .map((r: any) => ({ id: r.symbol, sym: r.symbol, name: r.shortname || r.longname || r.symbol }))
        }
        mHint = mResults.length ? `${mResults.length} MATCHES` : "NO MATCHES"
    } catch (e) { mHint = "SEARCH FAILED"; print("[cyber] market search:", e) }
    mScroll = 0
    mkModal?.requestDraw()
}

const spark = (ctx: any, x0: number, y0: number, x1: number, y1: number, hist: number[], col: any) => {
    if (!hist || hist.length < 2) return
    const mn = Math.min(...hist), mx = Math.max(...hist), rg = Math.max(1e-9, mx - mn)
    const mid = (y0 + y1) / 2
    const amp = Math.max(1, (y1 - y0) * 1.45)
    const pts: [number, number][] = hist.map((v, i) => {
        const t = (v - mn) / rg
        return [x0 + (i / (hist.length - 1)) * (x1 - x0), mid + (0.5 - t) * amp]
    })
    strokePath(ctx, MARKET_PLANE, pts, col, 0.72, 3.2)
    strokePath(ctx, MARKET_PLANE, pts, col, 1, 1.8)
}

const mixRgb = (a: any, b: any, t: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
]

const miniHist = (id: string, price: number, chg: number) => {
    const base = Math.max(0.0001, Number(price) || 0.0001)
    const seed = Array.from(String(id || "")).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    const amp = Math.max(0.002, Math.min(0.06, Math.abs(Number(chg) || 0) / 100 || 0.015))
    const out: number[] = []
    for (let i = 0; i < 14; i++) {
        const t = i / 13
        const wave = Math.sin(t * Math.PI * 2.2 + (seed & 15) * 0.4) * 0.42 + Math.cos(t * Math.PI * 4.1 + ((seed >> 4) & 15) * 0.3) * 0.18
        const trend = (t - 0.5) * amp * 1.7
        out.push(Math.max(0.0001, base * (1 + wave * amp + trend)))
    }
    return out
}

const triP = (ctx: any, x: number, y: number, up: boolean, col: any, a: number) => {
    const pts: [number, number][] = up
        ? [[x, y + 3], [x + 3.4, y - 2.4], [x + 6.8, y + 3], [x, y + 3]]
        : [[x, y - 2.4], [x + 3.4, y + 3], [x + 6.8, y - 2.4], [x, y - 2.4]]
    strokePath(ctx, MARKET_PLANE, pts, col, a, 2.2)
}

const wrapLines = (ctx: any, text: string, width: number, font: string, size: number, limit = 4) => {
    const words = clean(text).split(/\s+/).filter(Boolean)
    if (!words.length) return [""]
    ctx.selectFontFace(font, 0, 0)
    ctx.setFontSize(size)
    const lines: string[] = []
    let line = ""
    for (let i = 0; i < words.length; i++) {
        const word = words[i]
        const test = line ? `${line} ${word}` : word
        const w = ctx.textExtents(test).width
        if (w > width && line) {
            lines.push(line)
            line = word
            if (lines.length >= limit) return lines
        } else line = test
    }
    if (line && lines.length < limit) lines.push(line)
    if (lines.length === limit && words.join(" ").length > lines.join(" ").length) {
        lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\s+$/, "")}…`
    }
    return lines
}

const getMarketRows = (kind: string) => {
    const pinned = pins[kind].map((id: string) => ({ id, sym: quotes[keyOf(kind, id)]?.sym || (kind === "crypto" ? cryptoSym(id) : id.toUpperCase()), name: quotes[keyOf(kind, id)]?.name || id }))
    const loaded = browse[kind] || []
    const fallback = loaded.length ? [] : (DEFAULT_MARKETS[kind] || [])
    const rest = [...loaded, ...fallback].filter((r: any) => !isPinned(kind, r.id))
    const seen = new Set<string>()
    const rows = pinned.concat(rest).filter((r: any) => {
        if (!r?.id || seen.has(r.id)) return false
        seen.add(r.id)
        return true
    })
    return mResults.length ? mResults : rows
}

const marketDisplayRows = (kind: string) => {
    const rows = getMarketRows(kind)
    if (mResults.length || (!browseMore[kind] && !browseBusy[kind])) return rows
    return rows.concat([{ id: "__load_more__", sym: browseBusy[kind] ? "LOADING" : "LOAD MORE", name: browseBusy[kind] ? "fetching next market chunk" : "fetch next market chunk", loadMore: true }])
}

const newsDisplayRows = () => {
    if (!newsHasMore && !newsBusy) return newsRows
    return newsRows.concat([{ id: "__news_load_more__", title: newsBusy ? "LOADING..." : "LOAD MORE", source: newsBusy ? "FETCHING" : `${newsRows.length} LOADED`, ts: Date.now(), loadMore: true }])
}

const loadNextNews = async () => {
    if (newsBusy || !newsHasMore) return
    const before = newsRows.length
    newsBusy = true
    mkModal?.requestDraw()
    try {
        const city = readCity()
        newsCity = city.full || city.name || "LOCAL"
        const added = await appendNewsBatch(city)
        newsUpdated = Date.now()
        if (newsRows.length > before) newsScroll = Math.max(0, before - 1)
        newsHint = added > 0 ? `UPDATED ${new Date(newsUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}  ${newsRows.length} LOADED` : "NO NEW NEWS"
        if (!newsRows.some((r: any) => r.id === newsSel)) newsSel = newsRows[0]?.id || ""
    } catch (e) {
        newsHint = "NEWS FEEDS FAILED"
        print("[cyber] news more:", e)
    } finally {
        newsBusy = false
        mkModal?.requestDraw(); redraw()
    }
}

const currentMarket = (kind: string, rows: any[]) => {
    let sel = marketSel[kind]
    if (!sel || !rows.some((r: any) => r.id === sel)) sel = rows[0]?.id || ""
    marketSel[kind] = sel
    return rows.find((r: any) => r.id === sel) || rows[0] || null
}

const switchTab = (next: string) => {
    if (searchTimer !== null) { GLib.source_remove(searchTimer); searchTimer = null }
    tab = next
    mResults = []
    mQuery = ""
    mHint = "TYPE TO SEARCH"
    mScroll = 0
    newsScroll = 0
    if (tab === "news") refreshNews().catch(() => { })
    else { refreshAll(); primeBrowse(tab) }
    if (tab !== "news") {
        const rows = getMarketRows(tab)
        const cur = rows[0]
        if (cur) ensureSeries(tab, cur.id)
    }
    mkModal?.requestDraw()
}

const marketAddress = (selected: any) => {
    if (tab === "news") return `NETDIR://NUSA.STOCKXG.CORP/NEWS`
    const sym = selected?.sym || tab.toUpperCase()
    return `NETDIR://NUSA.STOCKXG.CORP/${tab.toUpperCase()}/${String(sym).toUpperCase()}`
}

const drawChart = (ctx: any, x: number, y: number, w: number, h: number, hist: number[], col: any, ts: number[] = []) => {
    ctx.save()
    ctx.setSourceRGBA(0.01, 0.03, 0.05, 0.78)
    ctx.rectangle(x, y, w, h)
    ctx.fill()
    ctx.setSourceRGBA(col[0], col[1], col[2], 0.22)
    ctx.setLineWidth(1)
    ctx.rectangle(x, y, w, h)
    ctx.stroke()
    if (hist && hist.length > 1) {
        const mn = Math.min(...hist)
        const mx = Math.max(...hist)
        const rg = Math.max(1e-9, mx - mn)
        const chartTop = y + 10
        const chartBot = y + h - 18
        const chartH = Math.max(1, chartBot - chartTop)
        for (let i = 1; i < 5; i++) {
            const yy = chartTop + (chartH / 5) * i
            ctx.setSourceRGBA(col[0], col[1], col[2], 0.09)
            ctx.moveTo(x + 8, yy)
            ctx.lineTo(x + w - 8, yy)
            ctx.stroke()
        }
        if (ts && ts.length > 1 && ts.length === hist.length) {
            const fmt = (n: number) => {
                const d = new Date(n)
                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
            }
            const idxs = [0, Math.max(0, Math.floor((hist.length - 1) * 0.33)), Math.max(0, Math.floor((hist.length - 1) * 0.66)), hist.length - 1]
            const seen = new Set<number>()
            for (const idx of idxs) {
                if (seen.has(idx)) continue
                seen.add(idx)
                const px = x + 8 + (idx / Math.max(1, hist.length - 1)) * (w - 16)
                ctx.setSourceRGBA(col[0], col[1], col[2], 0.24)
                ctx.moveTo(px, chartTop)
                ctx.lineTo(px, chartBot)
                ctx.stroke()
                gtxt(ctx, px - 11, y + h - 4, fmt(ts[idx]), GMONO, 7, RACC, 0.45)
            }
        }
        const labels = [mx, mn + rg * 0.66, mn + rg * 0.33, mn]
        labels.forEach((v, i) => {
            const yy = chartTop + (chartH / 3) * i
            gtxt(ctx, x + 6, yy + 3, priceFmt(v), GMONO, 7, RACC, 0.48)
        })
        ctx.newPath()
        hist.forEach((v, i) => {
            const px = x + 8 + (i / (hist.length - 1)) * (w - 16)
            const py = chartBot - ((v - mn) / rg) * chartH
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
        })
        ctx.setSourceRGBA(col[0], col[1], col[2], 0.95)
        ctx.setLineWidth(1.7)
        ctx.stroke()
    }
    ctx.restore()
}

const cycleTab = () => {
    if (tab === "stocks") switchTab("crypto")
    else if (tab === "crypto") switchTab("news")
    else switchTab("stocks")
}

const openNewsArticle = (id: string) => {
    tab = "news"
    newsSel = id
    newsScroll = 0
    ensureModal()
    if (mkModal?.isOpen?.()) mkModal.requestDraw()
    else mkModal?.open?.()
}

export const MarketsPanel = () => {
    loadPins()
    fetchBrowse("stocks").catch(() => { })
    fetchBrowse("crypto").catch(() => { })
    refreshAll()
    interval(60000, refreshAll)
    const area = DrawingArea({})
    areas.push(area)
    const RX0 = 6, RX1 = 300
    const rowX1 = 268
    const priceX = 82
    const changeX = 294
    const triX = 244
    const sparkX0 = 128
    const sparkX1 = 224
    let miniHits: any[] = []
    let hoverMiniNews = ""
    let hoverMiniAnim: any = {}
    area.set_size_request(MARKET_PLANE.width, MARKET_PLANE.height)
    area.connect("draw", (_w: any, ctx: any) => {
        miniHits = []
        const viewTab = tab
        const newsMini = newsRows.filter((r: any) => sameDay(r.ts))
        const list = viewTab === "news"
            ? (newsMini.length >= 5 ? newsMini : newsRows).slice(0, 5)
            : (pins[viewTab] || [])
        tiltText(ctx, MARKET_PLANE, RX0, 16, "MARKET FEED", TITLE, 13, NEON.netinfo, 0.95, { bold: true, glow: 0.3 })
        const tabs = [["STOCKS", "stocks"], ["CRYPTO", "crypto"], ["NEWS", "news"]]
        let tx = RX1 - 162
        for (const [label, id] of tabs) {
            const on = viewTab === id
            const hv = hoverAnim[id] || 0
            const col: any = on ? NEON.cyan : (hv > 0.02 ? NEON.amber : NEON.dim)
            tiltText(ctx, MARKET_PLANE, tx, 16, label, TITLE, 10, col, on ? 1 : 0.55 + hv * 0.4, { bold: true, glow: on ? 0.35 : hv * 0.4 })
            const uw = on ? 46 : 46 * hv
            if (uw > 0.5) fillQuad(ctx, MARKET_PLANE, tx, 19, tx + uw, 20.4, col, on ? 0.9 : 0.5 + hv * 0.4)
            tx += 56
        }
        fillQuad(ctx, MARKET_PLANE, RX0 - 2, 24, RX1 + 2, 196, [0, 0, 0], 0.014)
        fillQuad(ctx, MARKET_PLANE, RX0, 24, RX1, 25, NEON.red, 0.35)
        if (!list.length) {
            tiltText(ctx, MARKET_PLANE, RX0, 48, viewTab === "news" ? "NEWS LOADING..." : "NO PINS - DOUBLE CLICK TO ADD", MONO, 8, NEON.dim, 0.6)
            return false
        }
        if (viewTab === "news") {
            list.slice(0, 5).forEach((row: any, i: number) => {
                const y = 40 + i * 30
                const hv = hoverMiniAnim[row.id] || 0
                const accent: any = mixRgb(NEON.dim, NEON.white, hv)
                tiltText(ctx, MARKET_PLANE, RX0 + hv * 4, y, trunc(row.title, 32), TITLE, 10.5, accent, 0.65 + hv * 0.34, { bold: true, glow: 0.08 + hv * 0.34 })
                tiltText(ctx, MARKET_PLANE, RX0 + hv * 4, y + 11, `${trunc(row.source, 16)}  ${relTime(row.ts)}`, MONO, 6.4, mixRgb(NEON.dim, [210, 220, 226], hv), 0.52 + hv * 0.28)
                fillQuad(ctx, MARKET_PLANE, RX0, y + 16, rowX1, y + 16.6, hv > 0.02 ? NEON.cyan : NEON.grid, 0.24 + hv * 0.36)
                miniHits.push({ id: row.id, quad: projQuad(MARKET_PLANE, RX0 - 2, y - 7, rowX1, y + 15) })
            })
        } else {
            list.slice(0, MAXPIN).forEach((id: string, i: number) => {
                const q = quotes[keyOf(viewTab, id)]
                const y = 40 + i * 32
                const up = q && q.chg >= 0
                const col: any = q ? (up ? UP_RGB : DOWN_RGB) : NEON.dim
                const sym = q ? q.sym : (viewTab === "crypto" ? cryptoSym(id) : id.toUpperCase().slice(0, 10))
                tiltText(ctx, MARKET_PLANE, RX0, y, String(sym).slice(0, 8), TITLE, 11, NEON.cyan, 0.97, { bold: true, glow: 0.35 })
                tiltText(ctx, MARKET_PLANE, RX0, y + 11, q ? String(q.name).slice(0, 18) : "loading", MONO, 6.5, NEON.dim, 0.55)
                if (q && (!q.hist || q.hist.length < 4)) ensureSeries(viewTab, id)
                if (q) {
                    tiltText(ctx, MARKET_PLANE, priceX, y, priceFmt(q.price), MONO, 11, NEON.white, 1, { align: "r", bold: true, glow: 0.24, bloom: 0.1, shadow: 0.3 })
                    triP(ctx, triX, y - 3, up, col, 1)
                    tiltText(ctx, MARKET_PLANE, changeX, y, chgFmt(q.chg), MONO, 10, col, 1, { align: "r", bold: true, glow: 0.55, bloom: 0.22, shadow: 0.35 })
                    const sparkHist = q.hist && q.hist.length > 1 ? q.hist : miniHist(id, q.price, q.chg)
                    if (sparkHist.length > 1) spark(ctx, sparkX0, y - 8, sparkX1, y + 4, sparkHist, col)
                } else {
                    tiltText(ctx, MARKET_PLANE, priceX, y, "--", MONO, 10, NEON.dim, 0.8, { align: "r", bold: true })
                }
                fillQuad(ctx, MARKET_PLANE, RX0, y + 16, rowX1, y + 16.6, NEON.grid, 0.35)
            })
        }
        return false
    })
    let lastTap = 0
    const evt = EventBox({ child: Box({ className: "markets-panel", children: [area] }) })
    try { evt.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK) } catch { }
    let hoverT: any = null
    const stepHover = () => {
        let moving = false
        for (const id of ["stocks", "crypto", "news"]) {
            const target = hoverTab === id ? 1 : 0
            const cur = hoverAnim[id] || 0
            const nv = cur + (target - cur) * 0.28
            hoverAnim[id] = Math.abs(target - nv) < 0.01 ? target : nv
            if (hoverAnim[id] !== target) moving = true
        }
        const ids = new Set<string>([hoverMiniNews, ...Object.keys(hoverMiniAnim), ...miniHits.map((r: any) => r.id)].filter(Boolean))
        for (const id of ids) {
            const target = hoverMiniNews === id ? 1 : 0
            const cur = hoverMiniAnim[id] || 0
            const nv = cur + (target - cur) * 0.24
            hoverMiniAnim[id] = Math.abs(target - nv) < 0.01 ? target : nv
            if (hoverMiniAnim[id] !== target) moving = true
            if (hoverMiniAnim[id] === 0 && target === 0) delete hoverMiniAnim[id]
        }
        area.queue_draw()
        if (!moving && hoverT) { hoverT.cancel(); hoverT = null }
    }
    const kickHover = () => { if (!hoverT) hoverT = interval(40, stepHover) }
    const tabHit = (px: number, py: number) => {
        let hx = RX1 - 162
        for (const id of ["stocks", "crypto", "news"]) {
            if (pip(px, py, projQuad(MARKET_PLANE, hx - 4, 6, hx + 50, 22))) return id
            hx += 56
        }
        return ""
    }
    evt.connect("motion-notify-event", (_w: any, e: any) => {
        let px = 0, py = 0
        try { const c = e.get_coords?.(); if (c && c.length >= 3) { px = c[1]; py = c[2] } } catch { }
        const h = tabHit(px, py)
        if (h !== hoverTab) { hoverTab = h; kickHover() }
        if (tab === "news") {
            let nh = ""
            for (const r of miniHits) if (pip(px, py, r.quad)) { nh = r.id; break }
            if (nh !== hoverMiniNews) { hoverMiniNews = nh; kickHover() }
        }
        return false
    })
    evt.connect("leave-notify-event", () => { if (hoverTab || hoverMiniNews) { hoverTab = ""; hoverMiniNews = ""; kickHover() } return false })
    evt.connect("button-press-event", (_w: any, e: any) => {
        let px = 0, py = 0
        try { const c = e.get_coords?.(); if (c && c.length >= 3) { px = c[1]; py = c[2] } } catch { }
        const now = Date.now()
        if (now - lastTap < 420) { lastTap = 0; openMarketsModal(); return true }
        lastTap = now
        const hit = tabHit(px, py)
        if (hit) {
            if (tab !== hit) {
                tab = hit
                mResults = []
                mQuery = ""
                mHint = "TYPE TO SEARCH"
                mScroll = 0
                refreshAll()
                if (hit === "news") refreshNews().catch(() => { })
                else fetchBrowse(hit).catch(() => { })
                redraw()
            }
            return true
        }
        if (tab === "news") {
            for (const r of miniHits) {
                if (pip(px, py, r.quad)) { openNewsArticle(r.id); return true }
            }
        }
        return false
    })
    return evt
}

const drawMarketModal = (ctx: any, g: any) => {
    const x = g.X + 12
    const y = g.Y + GHEAD + 6
    const w = g.w - 24
    const h = g.h - GHEAD - 18
    const isNews = tab === "news"
    const rows = isNews ? [] : getMarketRows(tab)
    const active = isNews ? null : currentMarket(tab, rows)
    const selection = isNews ? (newsRows.find((r: any) => r.id === newsSel) || newsRows[0] || null) : active

    ctx.setSourceRGBA(0, 0, 0, 0.22)
    ctx.rectangle(x, y, w, h)
    ctx.fill()
    ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.26)
    ctx.setLineWidth(1)
    ctx.rectangle(x, y, w, h)
    ctx.stroke()

    const chromeY = y + 6
    const chromeH = 28
    const navY = chromeY + chromeH + 6
    const navH = 62
    const railY = navY + navH + 6
    const railH = 30
    const addr = marketAddress(selection)
    const addrW = Math.max(420, w - 190)
    const addrX = x + 176

    ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.50)
    ctx.rectangle(x, chromeY, 170, chromeH)
    ctx.setLineWidth(1)
    ctx.stroke()
    drawIcon(ctx, "keystore.png", x + 10, chromeY + 3, 23, 23, 0.95)
    gtxt(ctx, x + 40, chromeY + 20, "KEYSTORE", ENIXE, 16, ACC, 0.98, 1)

    ctx.setSourceRGBA(0.04, 0.15, 0.18, 0.74)
    ctx.rectangle(addrX, chromeY, addrW, chromeH)
    ctx.fill()
    ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.42)
    ctx.rectangle(addrX, chromeY, addrW, chromeH)
    ctx.stroke()
    ctx.save()
    ctx.rectangle(addrX + 12, chromeY, addrW - 212, chromeH)
    ctx.clip()
    gtxt(ctx, addrX + 12, chromeY + 19, addr, GMONO, 12, ACC, 0.98, 1)
    ctx.restore()
    const powered = "POWERED BY"
    const netwatch = "NETWATCH"
    const pw = textWidth(ctx, powered, FROSTBITE_WIDE, 6.8, 1)
    const nw = textWidth(ctx, netwatch, GUNSHIP_ITAL, 8.4, 1)
    const creditX = addrX + addrW - pw - nw - 26
    gtxt(ctx, creditX, chromeY + 18, powered, FROSTBITE_WIDE, 6.8, ACC, 0.54, 1)
    gtxt(ctx, creditX + pw + 8, chromeY + 18, netwatch, GUNSHIP_ITAL, 8.4, ACC, 0.82, 1)

    ctx.setSourceRGBA(0.01, 0.05, 0.07, 0.74)
    ctx.rectangle(x, navY, w, navH)
    ctx.fill()
    ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.36)
    ctx.rectangle(x, navY, w, navH)
    ctx.stroke()

    drawIcon(ctx, "nc_stock.png", x + 10, navY + 5, 78, 52, 0.9)

    const tabDefs = [["STOCKS", "stocks"], ["CRYPTO", "crypto"], ["NEWS", "news"]]
    const tabGap = 28
    const tabBoxes = tabDefs.map(([label, id]) => ({ label, id, bw: Math.ceil(textWidth(ctx, label, GTITLE, 13, 1) + 34) }))
    const tabsW = tabBoxes.reduce((sum, t) => sum + t.bw, 0) + tabGap * (tabBoxes.length - 1)
    let tx = x + w / 2 - tabsW / 2
    for (const t of tabBoxes) {
        const label = t.label
        const id = t.id
        const on = tab === id
        const hv = g.push.hoverKey === `tab:${id}`
        const col: any = on ? ACC : (hv ? [1, 0.82, 0.58] : RACC)
        const bw = t.bw
        const bh = 34
        const by = navY + 14
        const pulse = hv ? 0.55 + Math.sin(Date.now() / 120) * 0.18 : 0
        if (on || hv) {
            tabPath(ctx, tx, by, bw, bh)
            ctx.setSourceRGBA(col[0], col[1], col[2], hv ? 0.035 + pulse * 0.035 : 0)
            ctx.fill()
            tabPath(ctx, tx, by, bw, bh)
            ctx.setSourceRGBA(col[0], col[1], col[2], on ? 0.96 : 0.26 + pulse * 0.24)
            ctx.setLineWidth(1.1)
            ctx.stroke()
        }
        const tw = textWidth(ctx, label, GTITLE, 13, 1)
        gtxt(ctx, tx + (bw - tw) / 2, by + 23, label, GTITLE, 13, on ? ACC : [0.88, 0.95, 1], on ? 1 : 0.82 + pulse * 0.22, 1, hv ? 0.18 + pulse * 0.18 : 0)
        g.push({ kind: "tab", key: `tab:${id}`, hoverable: true, bx0: tx, by0: by, bx1: tx + bw, by1: by + bh, on: () => { if (tab !== id) switchTab(id) } })
        tx += bw + tabGap
    }

    const logoutW = 102
    const logoutX = x + w - logoutW - 14
    const logoutY = navY + 16
    const logoutHv = g.push.hoverKey === "logout"
    const logoutPulse = logoutHv ? 0.5 + Math.sin(Date.now() / 120) * 0.18 : 0
    logoutPath(ctx, logoutX, logoutY, logoutW, 30)
    ctx.setSourceRGBA(logoutHv ? ACC[0] : 0.02, logoutHv ? ACC[1] : 0.07, logoutHv ? ACC[2] : 0.08, logoutHv ? 0.055 + logoutPulse * 0.055 : 0.82)
    ctx.fill()
    logoutPath(ctx, logoutX, logoutY, logoutW, 30)
    ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], logoutHv ? 0.58 + logoutPulse * 0.28 : 0.24)
    ctx.setLineWidth(logoutHv ? 1.2 : 1)
    ctx.stroke()
    gtxt(ctx, logoutX + 24, logoutY + 20, "LOGOUT", TITLE, 13, ACC, logoutHv ? 1 : 0.9, 1, logoutHv ? 0.16 + logoutPulse * 0.16 : 0)
    g.push({ kind: "logout", key: "logout", hoverable: true, bx0: logoutX, by0: logoutY, bx1: logoutX + logoutW, by1: logoutY + 30, on: () => mkModal.close() })

    if (tab !== "news") {
        gtxt(ctx, x + w - 244, navY + 55, "TAB", GMONO, 8, RACC, 0.45)
        gtxt(ctx, x + w - 202, navY + 55, `PINNED ${pins[tab].length}/${MAXPIN}`, GMONO, 8.5, RACC, 0.72)
    } else {
        gtxt(ctx, x + w - 214, navY + 55, newsBusy ? "FETCHING" : "LIVE FEEDS", GMONO, 9, RACC, 0.68)
        gtxt(ctx, x + w - 214, navY + 42, newsHint, GMONO, 8, RACC, 0.42)
    }

    if (tab !== "news") {
        ctx.setSourceRGBA(0.02, 0.10, 0.12, 0.78)
        ctx.rectangle(x, railY, w, railH)
        ctx.fill()
        ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.36)
        ctx.rectangle(x, railY, w, railH)
        ctx.setLineWidth(1)
        ctx.stroke()
        const cur = (Math.floor(Date.now() / 450) % 2) ? "▌" : " "
        gpango(ctx, x + 14, railY + 19, mQuery ? mQuery + cur : (tab === "crypto" ? "search coins..." : "search tickers..."), GTITLE, false, 13, mQuery ? YEL : RACC, mQuery ? 0.97 : 0.45)
        gtxt(ctx, x + w - ctx.textExtents(mHint).width - 12, railY + 18, mHint, GMONO, 9, RACC, 0.62)
    } else {
        ctx.setSourceRGBA(0.01, 0.08, 0.10, 0.72)
        ctx.rectangle(x, railY, w, railH)
        ctx.fill()
        ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.28)
        ctx.rectangle(x, railY, w, railH)
        ctx.setLineWidth(1)
        ctx.stroke()
        gtxt(ctx, x + 14, railY + 19, `//LOCATION..${String(newsCity || "LOCAL").toUpperCase()}`, GTITLE, 12, ACC, 0.9, 1)
        gtxt(ctx, x + w - 98, railY + 19, newsBusy ? "FEEDING" : "NEWS LIVE", GMONO, 9, RACC, 0.7)
    }

    const bodyY = railY + 38
    const bodyH = y + h - bodyY - 8
    const listW = tab === "news" ? Math.round(w * 0.44) : Math.round(w * 0.41)
    const detailX = x + listW + 14
    const detailW = x + w - detailX

    if (tab === "news") {
        const rows = newsDisplayRows()
        const rowsH = 62
        const gap = 6
        const step = rowsH + gap
        const vis = Math.max(1, Math.floor(bodyH / step))
        const maxS = Math.max(0, rows.length - vis)
        newsScroll = clamp(newsScroll, 0, maxS)
        const start = newsScroll
        const selected = newsRows.find((r: any) => r.id === newsSel) || newsRows[0] || null
        if (selected && selected.id !== newsSel) newsSel = selected.id

        ctx.save()
        ctx.rectangle(x, bodyY, listW, bodyH)
        ctx.clip()
        for (let i = 0; i < vis; i++) {
            const row = rows[start + i]
            if (!row) break
            const ry = bodyY + i * step
            if (row.loadMore) {
                const hv = g.push.hoverKey === "news-load-more"
                const pulse = hv ? 0.5 + Math.sin(Date.now() / 120) * 0.18 : 0
                ctx.setSourceRGBA(0.02, 0.06, 0.08, 0.44 + pulse * 0.1)
                ctx.rectangle(x, ry, listW - 10, rowsH)
                ctx.fill()
                tabPath(ctx, x + 54, ry + 15, listW - 128, 32)
                ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.10 + pulse * 0.08)
                ctx.fill()
                tabPath(ctx, x + 54, ry + 15, listW - 128, 32)
                ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.52 + pulse * 0.36)
                ctx.setLineWidth(hv ? 1.2 : 1)
                ctx.stroke()
                const lbl = newsBusy ? "LOADING..." : "LOAD MORE"
                gtxt(ctx, x + listW / 2 - textWidth(ctx, lbl, GTITLE, 11, 1) / 2 - 5, ry + 36, lbl, GTITLE, 11, ACC, 0.78 + pulse * 0.2, 1, hv ? 0.2 + pulse * 0.18 : 0)
                if (!newsBusy) {
                    g.push({
                        kind: "news-load-more",
                        key: "news-load-more",
                        hoverable: true,
                        bx0: x + 54,
                        by0: ry + 15,
                        bx1: x + listW - 74,
                        by1: ry + 47,
                        on: () => { loadNextNews().catch(() => { }); mkModal.requestDraw() },
                    })
                }
                continue
            }
            const active = row.id === newsSel
            const hv = g.push.hoverKey === `news:${row.id}`
            const pulse = hv ? 0.5 + Math.sin(Date.now() / 120) * 0.18 : 0
            ctx.setSourceRGBA(0.02, 0.05, 0.07, active ? 0.72 : 0.42 + pulse * 0.08)
            ctx.rectangle(x, ry, listW - 10, rowsH)
            ctx.fill()
            if (hv) {
                ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.08 + pulse * 0.08)
                ctx.rectangle(x + 3, ry, listW - 13, rowsH)
                ctx.fill()
            }
            ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], active ? 0.92 : hv ? 0.48 + pulse * 0.32 : 0.25)
            ctx.rectangle(x, ry, 3, rowsH)
            ctx.fill()
            const titleLines = wrapLines(ctx, row.title, listW - 128, GTITLE, 11, 2)
            let ty = ry + 18
            for (const ln of titleLines) { gtxt(ctx, x + 12 + pulse * 4, ty, ln, GTITLE, 11, active || hv ? ACC : RACC, active ? 0.98 : 0.72 + pulse * 0.22, 1, hv ? 0.12 + pulse * 0.18 : 0); ty += 15 }
            gtxt(ctx, x + 12 + pulse * 4, ry + 54, `${row.source}  ${relTime(row.ts)}`, GMONO, 8, [0.94, 0.98, 1], 0.8 + pulse * 0.12)
            g.push({
                kind: "news-row",
                key: `news:${row.id}`,
                hoverable: true,
                bx0: x,
                by0: ry,
                bx1: x + listW - 10,
                by1: ry + rowsH,
                on: () => { newsSel = row.id; mkModal.requestDraw() },
            })
        }
        ctx.restore()
        drawScrollbar(ctx, x + listW - 7, bodyY, bodyH, rows.length, vis, newsScroll, CYAN)

        const article = selected || newsRows[0]
        ctx.setSourceRGBA(0.01, 0.04, 0.06, 0.76)
        ctx.rectangle(detailX, bodyY, detailW, bodyH)
        ctx.fill()
        ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.34)
        ctx.rectangle(detailX, bodyY, detailW, bodyH)
        ctx.setLineWidth(1)
        ctx.stroke()

        if (article) {
            const titleLines = wrapLines(ctx, article.title, detailW - 24, TITLE, 18, 3)
            let ty = bodyY + 30
            for (const ln of titleLines) { gtxt(ctx, detailX + 12, ty, ln, TITLE, 18, ACC, 0.98, 1, 0.2); ty += 22 }
            gtxt(ctx, detailX + 12, ty + 12, `${article.source}  •  ${article.region}  •  ${relTime(article.ts)}`, GMONO, 9, RACC, 0.72)
            gtxt(ctx, detailX + 12, ty + 29, article.published || "", GMONO, 8, RACC, 0.55)
            const lines = wrapLines(ctx, article.summary || article.title, detailW - 24, GTITLE, 12, 10)
            let sy = ty + 54
            for (const ln of lines) { gtxt(ctx, detailX + 12, sy, ln, GTITLE, 12, ACC, 0.9, 0, 0.05); sy += 18 }
            const link = "OPEN ARTICLE"
            const lw = ctx.textExtents(link).width
            const ly = bodyY + bodyH - 18
            gtxt(ctx, detailX + detailW - lw - 26, ly, link, GTITLE, 10, YEL, 0.95, 1)
            g.push({
                kind: "news-open-detail",
                key: `news-detail:${article.id}`,
                hoverable: true,
                bx0: detailX + detailW - lw - 30,
                by0: ly - 12,
                bx1: detailX + detailW - 14,
                by1: ly + 6,
                on: () => openUrl(article.url),
            })
        } else {
            gtxt(ctx, detailX + 12, bodyY + 32, newsBusy ? "FETCHING NEWS" : "NO NEWS FOUND", TITLE, 16, ACC, 0.84, 1, 0.1)
        }
    } else {
        const listRows = marketDisplayRows(tab)
        const rowH = 52
        const gap = 5
        const step = rowH + gap
        const vis = Math.max(1, Math.floor(bodyH / step))
        const maxS = Math.max(0, listRows.length - vis)
        mScroll = clamp(mScroll, 0, maxS)
        const sc = mScroll
        const current = active || listRows[0] || null
        if (current && current.id !== marketSel[tab]) marketSel[tab] = current.id

        ctx.save()
        ctx.rectangle(x, bodyY, listW, bodyH)
        ctx.clip()
        for (let i = 0; i < vis; i++) {
            const r = listRows[sc + i]
            if (!r) break
            const ry = bodyY + i * step
            if (r.loadMore) {
                const hv = g.push.hoverKey === `load-more:${tab}`
                const pulse = hv ? 0.5 + Math.sin(Date.now() / 120) * 0.18 : 0
                ctx.setSourceRGBA(0.02, 0.06, 0.08, 0.46 + pulse * 0.1)
                ctx.rectangle(x, ry, listW - 10, rowH)
                ctx.fill()
                tabPath(ctx, x + 72, ry + 12, listW - 164, 28)
                ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.12 + pulse * 0.06)
                ctx.fill()
                tabPath(ctx, x + 72, ry + 12, listW - 164, 28)
                ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.54 + pulse * 0.36)
                ctx.setLineWidth(1)
                ctx.stroke()
                const lbl = browseBusy[tab] ? "LOADING..." : "LOAD MORE"
                gtxt(ctx, x + listW / 2 - textWidth(ctx, lbl, GTITLE, 11, 1) / 2 - 5, ry + 31, lbl, GTITLE, 11, ACC, 0.78 + pulse * 0.2, 1, hv ? 0.2 + pulse * 0.18 : 0)
                if (!browseBusy[tab]) {
                    g.push({
                        kind: "load-more",
                        key: `load-more:${tab}`,
                        hoverable: true,
                        bx0: x + 72,
                        by0: ry + 12,
                        bx1: x + listW - 92,
                        by1: ry + 40,
                        on: () => { loadNextBrowse(tab).catch(() => { }); mkModal.requestDraw() },
                    })
                }
                continue
            }
            const on = isPinned(tab, r.id)
            const q = quotes[keyOf(tab, r.id)]
            const sel = current && r.id === current.id
            const rowHv = g.push.hoverKey === `row:${tab}:${r.id}`
            const rowPulse = rowHv ? 0.45 + Math.sin(Date.now() / 120) * 0.16 : 0
            ctx.setSourceRGBA(0.02, 0.05, 0.07, sel ? 0.78 : 0.45)
            marketRowPath(ctx, x, ry, listW - 10, rowH)
            ctx.fill()
            marketRowPath(ctx, x, ry, listW - 10, rowH)
            ctx.setSourceRGBA(ACC[0], ACC[1], ACC[2], sel ? 0.62 : (rowHv ? 0.44 + rowPulse * 0.18 : 0.24))
            ctx.setLineWidth(sel || rowHv ? 1.15 : 0.9)
            ctx.stroke()
            if (on) {
                ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], sel ? 0.86 : 0.62)
                ctx.rectangle(x + 12, ry + rowH - 5, 60, 2)
                ctx.fill()
            }
            gtxt(ctx, x + 14, ry + 19, r.sym, GTITLE, 13, on || sel ? ACC : RACC, 0.98, 1)
            gtxt(ctx, x + 14, ry + 34, String(r.name).slice(0, 34), GMONO, 8.5, RACC, 0.58)
            if (q) {
                const cc: any = q.chg >= 0 ? UP : DOWN
                gtxt(ctx, x + listW - 214, ry + 21, priceFmt(q.price), GMONO, 11, ACC, 0.96, 1)
                gtxt(ctx, x + listW - 126, ry + 21, chgFmt(q.chg), GMONO, 10, cc, 0.98, 1)
            }
            const btnX = x + listW - 86
            const btnY = ry + 15
            const locked = !on && !canPin(tab, r.id)
            const btnHv = g.push.hoverKey === `pin:${tab}:${r.id}`
            const btnPulse = btnHv ? 0.5 + Math.sin(Date.now() / 120) * 0.18 : 0
            const btnCol: any = locked ? DIMC : (on ? YEL : CYAN)
            cutPath(ctx, btnX, btnY, 72, 22, 5)
            ctx.setSourceRGBA(btnCol[0], btnCol[1], btnCol[2], locked ? 0.12 : (btnHv ? 0.22 + btnPulse * 0.08 : (on ? 0.18 : 0.10)))
            ctx.fill()
            cutPath(ctx, btnX, btnY, 72, 22, 5)
            ctx.setSourceRGBA(btnCol[0], btnCol[1], btnCol[2], locked ? 0.4 : (btnHv ? 0.98 : 0.92))
            ctx.setLineWidth(btnHv ? 1.2 : 1)
            ctx.stroke()
            const lbl = on ? "UNPIN" : "PIN"
            gtxt(ctx, btnX + 36 - ctx.textExtents(lbl).width / 2, btnY + 15, lbl, GTITLE, 10, btnCol, locked ? 0.45 : 0.95 + btnPulse * 0.05, 1, btnHv ? 0.16 + btnPulse * 0.16 : 0)
            if (!locked) {
                g.push({
                    kind: "pin",
                    key: `pin:${tab}:${r.id}`,
                    hoverable: true,
                    bx0: btnX,
                    by0: btnY,
                    bx1: btnX + 72,
                    by1: btnY + 22,
                    on: () => { if (!togglePin(tab, r.id)) mHint = `LIMIT ${MAXPIN} PER TAB`; mkModal.requestDraw() },
                })
            }
            g.push({
                kind: "market-row",
                key: `row:${tab}:${r.id}`,
                hoverable: true,
                bx0: x,
                by0: ry,
                bx1: x + listW - 96,
                by1: ry + rowH,
                on: () => { marketSel[tab] = r.id; ensureSeries(tab, r.id); mkModal.requestDraw() },
            })
        }
        ctx.restore()
        drawScrollbar(ctx, x + listW - 7, bodyY, bodyH, listRows.length, vis, mScroll, tab === "crypto" ? CYAN : YEL)

        const q = quotes[keyOf(tab, current?.id || "")]
        ctx.setSourceRGBA(0.01, 0.04, 0.06, 0.76)
        ctx.rectangle(detailX, bodyY, detailW, bodyH)
        ctx.fill()
        ctx.setSourceRGBA(CYAN[0], CYAN[1], CYAN[2], 0.34)
        ctx.rectangle(detailX, bodyY, detailW, bodyH)
        ctx.setLineWidth(1)
        ctx.stroke()

        if (current) {
            const name = String(current.name || current.sym || current.id)
            gtxt(ctx, detailX + 12, bodyY + 28, String(current.sym).toUpperCase(), TITLE, 24, ACC, 0.98, 1, 0.2)
            gtxt(ctx, detailX + 12, bodyY + 50, name, GTITLE, 13, RACC, 0.7)
            if (!q || !q.hist || q.hist.length < 2) ensureSeries(tab, current.id)
            if (q) {
                gtxt(ctx, detailX + 12, bodyY + 80, `${String(current.sym).toUpperCase()} - ${usdFmt(q.price)} $USD`, GTITLE, 12, ACC, 0.95, 1)
                const cc: any = q.chg >= 0 ? UP : DOWN
                gtxt(ctx, detailX + detailW - 12 - ctx.textExtents(chgFmt(q.chg)).width, bodyY + 80, chgFmt(q.chg), GTITLE, 12, cc, 0.95, 1)
                const hist = q.hist && q.hist.length > 1 ? q.hist : [q.price || 0, q.price || 0]
                const chartH = Math.max(128, Math.floor(bodyH * 0.38))
                drawChart(ctx, detailX + 12, bodyY + 98, detailW - 24, chartH, hist, cc, q.histTs || [])
                const statsY = bodyY + 98 + chartH + 16
                gtxt(ctx, detailX + 12, statsY, `PINNED ${pins[tab].length}/${MAXPIN}`, GMONO, 9, RACC, 0.7)
                gtxt(ctx, detailX + 12, statsY + 18, q.name || current.name || current.sym, GTITLE, 12, ACC, 0.9, 1)
                const meta = q.meta || {}
                const metricCol = tab === "crypto" ? CYAN : YEL
                const metricY = statsY + 40
                const cellW = Math.max(110, Math.floor((detailW - 32) / 2))
                const cellH = 34
                const gapX = 10
                const grid = tab === "crypto"
                    ? [
                        ["RANK", String(meta.market_cap_rank ?? "--")],
                        ["MKT CAP", numFmt(meta.market_cap)],
                        ["VOL 24H", numFmt(meta.total_volume)],
                        ["SUPPLY", numFmt(meta.circulating_supply)],
                        ["HIGH 24H", priceFmt(meta.high_24h)],
                        ["LOW 24H", priceFmt(meta.low_24h)],
                    ]
                    : [
                        ["EXCHANGE", String(meta.fullExchangeName || meta.exchangeName || "--")],
                        ["OPEN", priceFmt(meta.regularMarketOpen)],
                        ["HIGH", priceFmt(meta.regularMarketDayHigh)],
                        ["LOW", priceFmt(meta.regularMarketDayLow)],
                        ["VOLUME", numFmt(meta.regularMarketVolume)],
                        ["52W", `${priceFmt(meta.fiftyTwoWeekLow)} - ${priceFmt(meta.fiftyTwoWeekHigh)}`],
                    ]
                grid.forEach(([label, value], i) => {
                    const col = i % 2
                    const row = Math.floor(i / 2)
                    const gx = detailX + 12 + col * (cellW + gapX)
                    const gy = metricY + row * (cellH + 7)
                    drawMetricCell(ctx, gx, gy, cellW, cellH, label, String(value), metricCol)
                })
                const btn = isPinned(tab, current.id) ? "UNPIN" : "PIN"
                const bw = 84
                const bx = detailX + detailW - bw - 12
                const by = bodyY + bodyH - 42
                const locked = !isPinned(tab, current.id) && !canPin(tab, current.id)
                const pinHv = g.push.hoverKey === `detail-pin:${tab}:${current.id}`
                const pinPulse = pinHv ? 0.5 + Math.sin(Date.now() / 120) * 0.18 : 0
                const pinCol: any = locked ? DIMC : (isPinned(tab, current.id) ? YEL : CYAN)
                cutPath(ctx, bx, by, bw, 24, 6)
                ctx.setSourceRGBA(pinCol[0], pinCol[1], pinCol[2], locked ? 0.16 : (pinHv ? 0.22 + pinPulse * 0.08 : 0.12))
                ctx.fill()
                cutPath(ctx, bx, by, bw, 24, 6)
                ctx.setSourceRGBA(pinCol[0], pinCol[1], pinCol[2], locked ? 0.4 : (pinHv ? 0.98 : 0.95))
                ctx.setLineWidth(pinHv ? 1.2 : 1)
                ctx.stroke()
                gtxt(ctx, bx + 42 - ctx.textExtents(btn).width / 2, by + 16, btn, GTITLE, 10, pinCol, locked ? 0.4 : 0.95 + pinPulse * 0.05, 1, pinHv ? 0.16 + pinPulse * 0.16 : 0)
                if (!locked) {
                    g.push({
                        kind: "pin-detail",
                        key: `detail-pin:${tab}:${current.id}`,
                        hoverable: true,
                        bx0: bx,
                        by0: by,
                        bx1: bx + bw,
                        by1: by + 24,
                        on: () => { togglePin(tab, current.id); mkModal.requestDraw() },
                    })
                }
            }
        } else {
            gtxt(ctx, detailX + 12, bodyY + 32, "NO MARKET DATA", TITLE, 16, ACC, 0.84, 1, 0.1)
        }
    }
}

const ensureModal = () => {
    if (mkModal) return
    mkModal = createModal({
        name: "markets",
        tabTitle: "NET:TERMINAL",
        W: 1040,
        H: 690,
        col: CYAN,
        accent: ACC,
        glass: 0.58,
        onOpen: () => {
            mQuery = ""
            mResults = []
            mHint = "TYPE TO SEARCH"
            mScroll = 0
            refreshAll()
            if (tab === "news") refreshNews().catch(() => { })
            else primeBrowse(tab)
        },
        onScroll: (d: number) => {
            if (tab === "news") {
                const maxS = Math.max(0, newsDisplayRows().length - 1)
                newsScroll = clamp(newsScroll + d * 2, 0, maxS)
            } else {
                mScroll = clamp(mScroll + d * 2, 0, Math.max(0, marketDisplayRows(tab).length - 1))
            }
            mkModal.requestDraw()
        },
        onKey: (k: number) => {
            if (k === Gdk.KEY_Tab) { cycleTab(); return }
            if (tab === "news") {
                if (k === Gdk.KEY_Up) { newsScroll = clamp(newsScroll - 1, 0, Math.max(0, newsDisplayRows().length - 1)); mkModal.requestDraw(); return }
                if (k === Gdk.KEY_Down) { newsScroll = clamp(newsScroll + 1, 0, Math.max(0, newsDisplayRows().length - 1)); mkModal.requestDraw(); return }
                if (k === Gdk.KEY_Return || k === Gdk.KEY_KP_Enter) {
                    const cur = newsRows.find((r: any) => r.id === newsSel) || newsRows[0]
                    if (cur) openUrl(cur.url)
                    return
                }
                return
            }
            if (k === Gdk.KEY_BackSpace) mQuery = mQuery.slice(0, -1)
            else {
                const u = Gdk.keyval_to_unicode(k)
                if (u >= 32 && u < 0x10000) mQuery += String.fromCharCode(u)
                else return
            }
            queueSearch()
        },
        draw: drawMarketModal,
    })
}

export const openMarketsModal = () => { ensureModal(); mkModal.toggle() }
