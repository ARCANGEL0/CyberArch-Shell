



import { Box, DrawingArea, EventBox, Keymode } from "./widget.ts"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import { interval, execAsync } from "astal"
import { CYBER_DIR } from "../../env.ts"
import { makePlane, tiltText, strokePath, fillQuad, alertChip } from "./proj.ts"
import { NEON, USER, onColorChange, tintOpaque, mapAccent } from "./colors.ts"
import { createModal } from "./cmodal.ts"
import { txt as gtxt, pango as gpango, RED, RACC, CYAN as GCYAN, ACC as GACC, HEADER as GHEAD, TITLE as GTITLE, MONO as GMONO, pip, projQuad } from "./glass.ts"
import { openTimeModal } from "./timeset.ts"

const Cairo = (imports).cairo

import { TITLE, MONO, ICONF } from "./fonts.ts"
const NETCOL: [number, number, number] = NEON.netinfo
const MAPACC: [number, number, number] = NEON.mapaccent
const NETCHIP: [number, number, number] = NEON.netchip
const NETUP: [number, number, number] = NEON.netup
const NETDN: [number, number, number] = NEON.netdown
const W = 320, H = 530
const MAP_DX = 100
const minimapBase = makePlane({ w: W, h: H, yaw: 24, pitch: 3, roll: -1, focal: 1300, dist: 1300, pad: 0 })
const minimap = {
 ...minimapBase,
 project: (u, v) => {
 const [x, y] = minimapBase.project(u, v)
 return [x + MAP_DX, y]
 },
 width: minimapBase.width + MAP_DX,
}
const plane = makePlane({ w: W, h: H, yaw: 24, pitch: 2, roll: -2, focal: 4600, dist: 4200, pad: 42 })


const CONN_DX = 0, CONN_DY = -60
const connBase = makePlane({ w: W, h: H, yaw: 34, pitch: -12, roll: 6, focal: 4600, dist: 4200, pad: 42 })
const connPlane = {
 ...connBase,
 project: (u, v) => { const [x, y] = connBase.project(u, v); return [x + CONN_DX, y + CONN_DY] as [number, number] },
}
const ICON_DX = 0, ICON_DY = 0
const iconBase = makePlane({ w: W, h: H, yaw: 34, pitch: -12, roll: 6, focal: 4600, dist: 4200, pad: 42 })
const iconPlane = {
 ...iconBase,
 project: (u, v) => { const [x, y] = iconBase.project(u, v); return [x + CONN_DX + ICON_DX, y + CONN_DY + ICON_DY] as [number, number] },
}
const pad2 = (n) => String(n).padStart(2, "0")
const WD3 = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const ch = (c) => String.fromCharCode(c)
const WXI = { sun: ch(0xe30d), part: ch(0xe302), cloud: ch(0xe312), rain: ch(0xe318), snow: ch(0xe31a), storm: ch(0xe31d), fog: ch(0xe313) }
const wxIcon = (desc) => {
 const d = desc.toLowerCase()
 if (/thunder|storm/.test(d)) return WXI.storm
 if (/snow|sleet|ice|blizzard/.test(d)) return WXI.snow
 if (/rain|drizzle|shower/.test(d)) return WXI.rain
 if (/fog|mist|haze/.test(d)) return WXI.fog
 if (/part|few/.test(d)) return WXI.part
 if (/cloud|overcast/.test(d)) return WXI.cloud
 return WXI.sun
}


let geoCity = "NEW YORK", geoCoords = "40.713°N 74.006°W", geoOK = true
let geoLat = 40.7128, geoLon = -74.006, mapTile = null, mapVer = 0, mapRequest = 0
let mapCachePath = ""
let wxLat = 40.7128, wxLon = -74.006, wxName = "NEW YORK", wxFull = "NEW YORK"
let wxTemp = "--°", wxDesc = "—", wxFeels = "--°", wxHum = "--", wxWind = "--"
let netName = "OFFLINE"
const refreshNet = () => {

 execAsync(["sh", "-c", "iwgetid -r 2>/dev/null | sed 's/^/WiFi: /' | grep . || nmcli -t -f TYPE,STATE device 2>/dev/null | awk -F: '$1==\"ethernet\" && $2==\"connected\"{c++; print \"Ethernet \" c; exit}' | grep . || echo OFFLINE"])
     .then((o) => { const s = (o || "").trim(); netName = s || "OFFLINE"; areas.forEach(a => a?.queue_draw()) })
     .catch(() => { netName = "OFFLINE" })
}
let netUp = "0.0", netDown = "0.0"
let _prx = -1, _ptx = 0, _pnt = 0
const readProc = (p) => { try { const [ok, d] = GLib.file_get_contents(p); return ok ? new TextDecoder().decode(d) : "" } catch { return "" } }
const netIface = () => { for (const l of readProc("/proc/net/route").split("\n").slice(1)) { const p = l.split(/\s+/); if (p[1] === "00000000" && p[0]) return p[0] } return "" }
const netCounters = (iface) => { const l = readProc("/proc/net/dev").split("\n").find(x => x.trim().startsWith(iface + ":")); if (!l) return [0, 0]; const p = l.split(":")[1].trim().split(/\s+/).map(Number); return [p[0], p[8]] }
const mbpsFmt = (bps) => { const m = bps * 8 / 1e6; return m >= 100 ? m.toFixed(0) : m.toFixed(1) }
const refreshNetSpeed = () => {
 const iface = netIface()
 const now = GLib.get_monotonic_time()
 const [rx, tx] = iface ? netCounters(iface) : [0, 0]
 if (_prx >= 0 && _pnt > 0) { const dt = Math.max(1e-6, (now - _pnt) / 1e6); netDown = mbpsFmt(Math.max(0, (rx - _prx) / dt)); netUp = mbpsFmt(Math.max(0, (tx - _ptx) / dt)) }
 _prx = rx; _ptx = tx; _pnt = now
 areas.forEach(a => a?.queue_draw())
}
const WMO = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain", 81: "Rain", 82: "Heavy rain", 85: "Snow", 86: "Heavy snow", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" }
const forecast: { day: string; hi: string; lo: string; code: number; pop: number; hiN: number; loN: number; wind: number; uv: number; sunrise: string; sunset: string; date: string }[] = []
let areas: any[] = []
let paletteGen = 0
onColorChange(() => { paletteGen++; areas.forEach(a => a?.queue_draw()) })


const ro = () => (Math.random() - 0.5) * 0.055
const mapCacheDir = `${GLib.getenv("XDG_CACHE_HOME") || `${GLib.getenv("HOME") || "/tmp"}/.cache`}/cyberpunk-maps`
const mapCacheForPoint = () => `${mapCacheDir}/map-${geoLat.toFixed(5)}-${geoLon.toFixed(5)}.png`
const loadMapCache = (path) => {
 try {
  const t = Cairo.ImageSurface.createFromPNG(path)
  if (t) { mapTile = t; mapVer++; return true }
 } catch {}
 return false
}
const setMapPoint = (rerandom) => {
 if (rerandom) { geoLat = wxLat + ro(); geoLon = wxLon + ro() }
 if (!mapCachePath) mapCachePath = mapCacheForPoint()
 geoCoords = `${Math.abs(geoLat).toFixed(3)}°${geoLat >= 0 ? "N" : "S"} ${Math.abs(geoLon).toFixed(3)}°${geoLon >= 0 ? "E" : "W"}`
 geoCity = wxFull; geoOK = true
 areas.forEach(a => a?.queue_draw()); fetchMap()
}


const WX_STORE = `${CYBER_DIR}/config/city.json`
const saveWxLocation = () => {
 try {
  GLib.file_set_contents(WX_STORE, new TextEncoder().encode(JSON.stringify({ name: wxName, full: wxFull, lat: wxLat, lon: wxLon, mapLat: geoLat, mapLon: geoLon, mapCache: mapCachePath }, null, 2) + "\n"))
 } catch (e) { print("[cyber] wx save:", e) }
}
const loadWxLocation = () => {
 try {
 const [ok, data] = GLib.file_get_contents(WX_STORE)
 if (ok) {
 const o = JSON.parse(new TextDecoder().decode(data))
 if (typeof o.lat === "number" && typeof o.lon === "number") {
 wxLat = o.lat; wxLon = o.lon; wxName = String(o.name || wxName); wxFull = String(o.full || o.name || wxName)
 if (typeof o.mapLat === "number" && typeof o.mapLon === "number") {
  geoLat = o.mapLat; geoLon = o.mapLon
  mapCachePath = typeof o.mapCache === "string" ? o.mapCache : mapCacheForPoint()
  loadMapCache(mapCachePath)
  setMapPoint(false)
 } else {
  mapCachePath = ""
  setMapPoint(true)
 }
 return
 }
 }
 } catch {}
 setMapPoint(true)
}


// change of minimap get func, since cartoAPI is hitting ratelimits (i thought it was free),
// changed to OpenStreetMap. changing the location from city.json triggers rendering a new
// tilemap of a random location. chill, the theme does not track your geolocation,
// but a random place from the city provided.
const fetchMap = () => {
 const out = "/tmp/cyber-map.png"
 const request = ++mapRequest
 const lat = geoLat, lon = geoLon
 execAsync(["python3", `${CYBER_DIR}/scripts/gen-map.py`, String(lat), String(lon), out])
     .then(() => {
	// fix for changing tiles when city.json is updated
	// also caches that images on system for next boots, instead falling back to default image
     if (request !== mapRequest) return
     try {
      GLib.mkdir_with_parents(mapCacheDir, 0o755)
      const [ok, data] = GLib.file_get_contents(out)
      if (ok && mapCachePath) GLib.file_set_contents(mapCachePath, data)
     } catch (e) { print("[cyber] map cache:", e) }
     const t = Cairo.ImageSurface.createFromPNG(mapCachePath || out)
     if (t) { mapTile = t; mapVer++; saveWxLocation(); areas.forEach(a => a?.queue_draw()) }
     })
     .catch(() => {
     if (request !== mapRequest) return
     try { mapTile = Cairo.ImageSurface.createFromPNG(`${CYBER_DIR}/assets/img/map-grid.png`); if (mapTile) mapVer++; areas.forEach(a => a?.queue_draw()) } catch {}
     })
}
const refreshWeather = async () => {
 try {
 const url = `https://api.open-meteo.com/v1/forecast?latitude=${wxLat}&longitude=${wxLon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset&forecast_days=7&timezone=auto`
 const j = JSON.parse(await execAsync(["curl", "-sf", "--max-time", "9", url]))
 const c = j.current
 if (c) { wxTemp = `${Math.round(c.temperature_2m)}°`; wxFeels = `${Math.round(c.apparent_temperature)}°`; wxDesc = WMO[c.weather_code] || "—"; wxHum = `${Math.round(c.relative_humidity_2m)}`; wxWind = `${Math.round(c.wind_speed_10m)}` }
 const dd = j.daily; forecast.length = 0
 if (dd && dd.time) for (let i = 0; i < dd.time.length && i < 7; i++) {
 const dt = new Date(dd.time[i] + "T12:00:00")
 const hiN = Math.round(dd.temperature_2m_max[i]), loN = Math.round(dd.temperature_2m_min[i])
 forecast.push({
 day: WD3[dt.getDay()], hi: `${hiN}°`, lo: `${loN}°`, hiN, loN,
 code: dd.weather_code?.[i] ?? 0, pop: dd.precipitation_probability_max?.[i] ?? 0,
 wind: Math.round(dd.wind_speed_10m_max?.[i] ?? 0), uv: Math.round(dd.uv_index_max?.[i] ?? 0),
 sunrise: (dd.sunrise?.[i] || "").slice(11, 16), sunset: (dd.sunset?.[i] || "").slice(11, 16),
 date: `${dt.getDate()} ${MON3[dt.getMonth()]}`,
 })
 }
 } catch (e) { wxDesc = "OFFLINE" }
 areas.forEach(a => a?.queue_draw())
}


const MX0 = 14, MY0 = 50, MX1 = W - 14, MY1 = 318
const BLV = 10

const NTY1 = MY0 + (MY1 - MY0) * 0.74, NTY0 = MY0 + (MY1 - MY0) * 0.24, NTW = 5, NDD = 8
const MAP_SHAPE = [
 [MX0, MY0], [MX1, MY0], [MX1, MY1],
 [MX0 + BLV, MY1], [MX0, MY1 - BLV],
 [MX0, NTY1], [MX0 + NTW, NTY1 - NDD], [MX0 + NTW, NTY0 + NDD], [MX0, NTY0],
]

const BUILDINGS: [number, number, number, number][] = (() => {
 const b: [number, number, number, number][] = []; let s = 91
 const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647 }
 for (let gy = MY0 + 12; gy < MY1 - 30; gy += 40)
 for (let gx = MX0 + 12; gx < MX1 - 36; gx += 52) {
 if (rnd() < 0.18) continue
 b.push([gx + rnd() * 10, gy + rnd() * 8, 26 + rnd() * 28, 18 + rnd() * 20])
 }
 return b
})()
const clipMap = (ctx) => {
 ctx.newPath(); MAP_SHAPE.map(([u, v]: [number, number]) => minimap.project(u, v)).forEach(([x, y]: [number, number], i: number) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip()
}

const drawMapStatic = (ctx) => {
 const cx = (MX0 + MX1) / 2, cy = (MY0 + MY1) / 2
 ctx.save(); clipMap(ctx)
 if (mapTile) {

 const c = MAP_SHAPE.map(([u, v]) => minimap.project(u, v)), xs = c.map(p => p[0]), ys = c.map(p => p[1])
 const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys)
 const tw = mapTile.getWidth(), th = mapTile.getHeight()
 ctx.save(); ctx.translate(mnx, mny); ctx.scale((mxx - mnx) / tw, (mxy - mny) / th)
 ctx.setSourceSurface(mapTile, 0, 0); try { ctx.getSource().setFilter(1) } catch {}; ctx.paint()
 tintOpaque(ctx, tw, th, 0.75); ctx.restore()
 fillQuad(ctx, minimap, MX0, MY0, MX1, MY1, [6, 7, 10], 0.16)
 } else {
 fillQuad(ctx, minimap, MX0, MY0, MX1, MY1, [14, 8, 10], 0.87)
 for (const [bx, by, bw, bh] of BUILDINGS) {
 strokePath(ctx, minimap, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], NEON.white, 0.32, 1, true)
 if (((bx + by) | 0) % 3 === 0) strokePath(ctx, minimap, [[bx + bw * 0.5, by], [bx + bw * 0.5, by + bh]], NEON.white, 0.18, 1)
 }
 }
 ctx.restore()
 strokePath(ctx, minimap, MAP_SHAPE, [81, 104, 111], 0.25, 1.4, true)
 strokePath(ctx, minimap, MAP_SHAPE, [81, 104, 111], 1, 0.9, true)

 tiltText(ctx, minimap, MX1 - 8, MY1 - 10, geoCoords, MONO, 8, geoOK ? MAPACC : NEON.red, 0.55, { align: "r" })
}


const drawCompassScan = (ctx) => {
 const px = 150, py = 216
 const legs = [[px - 6, py + 6], [px, py - 7], [px + 6, py + 6]]
 const bar = [[px - 3.3, py], [px, py + 3.5], [px + 3.3, py]]
 strokePath(ctx, minimap, legs, MAPACC, 0.3, 3.5)
 strokePath(ctx, minimap, bar, MAPACC, 0.3, 3.5)
 strokePath(ctx, minimap, legs, MAPACC, 0.95, 1.5)
 strokePath(ctx, minimap, bar, MAPACC, 0.9, 1.3)
}
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const ordDay = (d) => { const j = d % 10, k = d % 100; return d + (j === 1 && k !== 11 ? "st" : j === 2 && k !== 12 ? "nd" : j === 3 && k !== 13 ? "rd" : "th") }
const fmtDate = (now) => `${ordDay(now.getDate())} ${MON3[now.getMonth()]}, ${now.getFullYear()}`

const drawOverlay = (ctx, now) => {
 tiltText(ctx, minimap, MX0 + 8, MY0 + 10, "55S.441.20", MONO, 7, MAPACC, 0.34)
 tiltText(ctx, minimap, MX1, MY0 - 5, (geoCity || "NIGHT CITY").slice(0, 32), TITLE, 9, mapAccent.city, 0.9, { align: "r", bold: true, glow: 0.4 })
  const tstr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
 const tcx = MX0 + 4, tcy = MY0 - 7
 tiltText(ctx, minimap, tcx, tcy, tstr, TITLE, 18.1, mapAccent.clock, 0.92, { bold: true, glow: 0.82,extraRotate: 0.01  })
 const FORECOL = mapAccent.forecast || NETCOL
 tiltText(ctx, minimap, MX0 + 14, MY1 - 14, wxIcon(wxDesc), ICONF, 10, FORECOL, 0.95, { bold: true, glow: 0.3 })
 tiltText(ctx, minimap, MX0 + 30, MY1 - 14, `${wxDesc.toUpperCase()} · ${wxTemp}`, TITLE, 9.5, FORECOL, 0.92, { bold: true, glow: 0.3 })
 tiltText(ctx, minimap, MX0 + 2, MY1 + 16, `FEELS LIKE ${wxFeels} · HUM ${wxHum}% · WIND ${wxWind}`, MONO, 6.6, MAPACC, 0.52, { bold: true })
 tiltText(ctx, minimap, MX1, MY1 + 16, fmtDate(now), MONO, 9.5, FORECOL, 0.9, { bold: true, align: "r", glow: 0.38 })
 const fy = MY1 + 36
 fillQuad(ctx, minimap, MX0 - 2, fy - 8, MX1 + 2, fy + 70, [0, 0, 0], 0.012)
 strokePath(ctx, minimap, [[MX0 + 2, fy + 5], [MX1 - 2, fy + 5]], FORECOL, 0.16, 5)
 strokePath(ctx, minimap, [[MX0 + 2, fy + 5], [MX1 - 2, fy + 5]], FORECOL, 0.62, 1)
 tiltText(ctx, minimap, MX0, fy, "7-DAY FORECAST", TITLE, 9, FORECOL, 0.85, { bold: true, glow: 0.32 })
 tiltText(ctx, minimap, MX1, fy, "L-CLICK \u25B8 DETAILS \u00B7 R \u25B8 CITY", MONO, 7, MAPACC, 0.38, { align: "r" })
 const span = (MX1 - MX0) / 7
 for (let i = 0; i < 7; i++) {
 const cx = MX0 + i * span + span / 2, d = forecast[i], today = i === 0
 if (today) fillQuad(ctx, minimap, MX0 + i * span + 1, fy + 8, MX0 + (i + 1) * span - 1, fy + 66, FORECOL, 0.1)
 tiltText(ctx, minimap, cx, fy + 20, d ? d.day : "--", TITLE, 9, today ? FORECOL : NEON.white, today ? 0.97 : 0.6, { align: "c", bold: true, glow: today ? 0.3 : 0 })
 tiltText(ctx, minimap, cx, fy + 37, d ? wxIcon(WMO[d.code] || "") : "", ICONF, 13, today ? FORECOL : MAPACC, 0.85, { align: "c" })
 tiltText(ctx, minimap, cx, fy + 51, d ? d.hi : "--", MONO, 10, today ? FORECOL : NEON.white, 0.9, { align: "c", bold: true })
 tiltText(ctx, minimap, cx, fy + 63, d ? d.lo : "--", MONO, 8, MAPACC, 0.5, { align: "c" })
 }


 const ny = fy + 121, dx = 72
 const off = !netName || netName === "OFFLINE"
 const stxt = off ? "OFFLINE!" : netName
 tiltText(ctx, connPlane, MX0 - 16 + dx, ny, "NETWORK STATUS", TITLE, 14, NETCOL, 1, { bold: true, glow: 0.22, bloom: 0.45, shadow: 1 })
 alertChip(ctx, iconPlane, MX0 + 6 + dx, ny + 11, NETCHIP, 0.8)
 tiltText(ctx, connPlane, MX0 + 26 + dx, ny + 22, stxt, TITLE, 14, NETCOL, 0.95, { bold: true, glow: off ? 0.22 : 0.1, bloom: 0.45, shadow: 1 })
}
const drawNetSpeed = (ctx) => {
 const fy = MY1 + 65, ny = fy + 91, ux = MX0 + 276
 tiltText(ctx, connPlane, ux - 70, ny - 1, "", ICONF, 9, NETUP, 0.95, { bold: true, align: "r" })
 tiltText(ctx, connPlane, ux - 25, ny - 1, `${netUp} Mbps`, MONO, 8.5, NETUP, 0.92, { bold: true, align: "r", glow: 0.3 })
 tiltText(ctx, connPlane, ux - 50, ny + 22, "", ICONF, 9, NETDN, 0.95, { bold: true, align: "r" })
 tiltText(ctx, connPlane, ux - 8, ny + 22, `${netDown} Mbps`, MONO, 8.5, NETDN, 0.92, { bold: true, align: "r", glow: 0.3 })
}
let cache = null, cacheKey = ""

export const SidePanel = () => {
 ensureWxModal()
 loadWxLocation(); refreshWeather()
 interval(1_800_000, refreshWeather)
 refreshNet(); interval(15_000, refreshNet)
 refreshNetSpeed(); interval(1000, refreshNetSpeed)
 const area = DrawingArea({}); areas.push(area); area.set_size_request(plane.width, plane.height)
 if (!mapTile) try { mapTile = Cairo.ImageSurface.createFromPNG(`${CYBER_DIR}/assets/img/map-grid.png`); mapVer++ } catch {}
 area.connect("draw", (_w, ctx) => {
 const now = new Date()

 const key = `${paletteGen}|${mapVer}|${pad2(now.getHours())}${pad2(now.getMinutes())}|${wxName}|${wxTemp}|${wxDesc}|${wxFeels}|${geoCoords}|${geoCity}|${wxHum}|${wxWind}|${netName}|${forecast.map(f => f.hi + f.lo).join("")}`
 if (!cache || cacheKey !== key) {
 cacheKey = key
 cache = new Cairo.ImageSurface(Cairo.Format.ARGB32, plane.width, plane.height)
 const cx = new Cairo.Context(cache)
 drawMapStatic(cx); drawOverlay(cx, now)
 }
 ctx.setSourceSurface(cache, 0, 0); ctx.paint()
 drawCompassScan(ctx)
 drawNetSpeed(ctx)
 return false
 })


 const evt = EventBox({ child: Box({ className: "side-panel", children: [area] }) })
 try { evt.add_events(Gdk.EventMask.BUTTON_PRESS_MASK) } catch {}
 evt.connect("button-press-event", (_w, e) => {
 let btn = 0
 try { btn = e.get_button?.()[1] ?? 0 } catch {}
 let px = 0, py = 0
 try { const c = e.get_coords?.(); if (c && c.length >= 3) { px = c[1]; py = c[2] } } catch {}
 const onClock = pip(px, py, projQuad(minimap, MX0 + 2, MY0 - 26, MX0 + 76, MY0 + 4))
 const onWx = pip(px, py, projQuad(minimap, MX0 - 4, MY1 - 28, MX1 + 4, MY1 + 110))
 if (btn === 3 && onClock) { openTimeModal(); return true }
 if (btn === 1 && onWx) { openForecastModal(); return true }
 if (btn === 3) openCityModal()
 return false
 })
 return evt
}


let wxModal: any = null
let wxQuery = "", wxResults: any[] = [], wxHint = "TYPE A CITY ▸", wxScroll = 0
let wxSearchTimer: number | null = null
const aPath = (ctx, x, y, w, h, c = 5) => { ctx.newPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath() }

const wxRunSearch = async () => {
 const q = wxQuery.trim()
 if (q.length < 2) { wxResults = []; wxHint = "TYPE A CITY ▸"; wxModal?.requestDraw(); return }
 wxHint = "SEARCHING…"; wxModal?.requestDraw()
 try {
 const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
 const data = JSON.parse(await execAsync(["curl", "-sf", "--max-time", "6", url]))
 wxResults = (data.results || []).map((r) => ({ lat: r.latitude, lon: r.longitude, name: r.name, full: [r.name, r.admin1, r.country].filter(Boolean).join(", ") }))
 wxHint = wxResults.length ? `${wxResults.length} MATCHES — CLICK ONE` : "NO MATCHES"
 } catch (e) { wxHint = "SEARCH FAILED"; print("[cyber] geocode:", e) }
 wxScroll = 0; wxModal?.requestDraw()
}
const wxQueueSearch = () => { if (wxSearchTimer !== null) GLib.source_remove(wxSearchTimer); wxSearchTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 340, () => { wxSearchTimer = null; wxRunSearch().catch(print); return false }) }
const wxPick = (r) => { wxLat = r.lat; wxLon = r.lon; wxName = String(r.name || "").toUpperCase(); wxFull = r.full.toUpperCase(); mapCachePath = ""; setMapPoint(true); saveWxLocation(); refreshWeather(); wxModal.close() }

const ensureWxModal = () => {
 if (wxModal) return
 wxModal = createModal({
 name: "weather", tabTitle: "WEATHER UPLINK", W: 384, H: 312, hud: true, col: RED, accent: RACC,
 onOpen: () => { wxQuery = ""; wxResults = []; wxHint = "TYPE A CITY ▸"; wxScroll = 0 },
 onKey: (k) => {
 if (k === Gdk.KEY_BackSpace) wxQuery = wxQuery.slice(0, -1)
 else { const u = Gdk.keyval_to_unicode(k); if (u >= 32 && u < 0x10000) wxQuery += String.fromCharCode(u); else return }
 wxQueueSearch(); wxModal.requestDraw()
 },
 onScroll: (d) => { wxScroll = Math.max(0, Math.min(Math.max(0, wxResults.length - 1), wxScroll + d)); wxModal.requestDraw() },
 draw: (ctx, g) => {
 const x = g.X + 18, w = g.w - 36
 gtxt(ctx, x + w - 4 - ctx.textExtents(`NOW: ${wxName}`).width, g.Y + GHEAD + 22, `NOW: ${wxName}`, GMONO, 9, RED, 0.6)
 gtxt(ctx, x, g.Y + GHEAD + 22, "SEARCH FORECAST CITY", GMONO, 10, RED, 0.85, 1)
 const by = g.Y + GHEAD + 32, bh = 30
 aPath(ctx, x, by, w, bh, 6); ctx.setSourceRGBA(RED[0] * 0.12, RED[1] * 0.06, RED[2] * 0.06, 0.5); ctx.fill()
 aPath(ctx, x, by, w, bh, 6); ctx.setSourceRGBA(RED[0], RED[1], RED[2], 0.85); ctx.setLineWidth(0.9); ctx.stroke()
 const cur = (Math.floor(Date.now() / 450) % 2) ? "▌" : " "
 gpango(ctx, x + 14, by + bh / 2 + 5, (wxQuery ? wxQuery + cur : "Search a city…"), GTITLE, false, 13, wxQuery ? RACC : RED, wxQuery ? 0.96 : 0.4)
 gtxt(ctx, x, by + bh + 18, "// " + wxHint, GMONO, 9, RED, 0.6)
 const ly = by + bh + 28, lh = (g.Y + g.h) - ly - 22, rowH = 30, gap = 5, step = rowH + gap, vis = Math.max(1, Math.floor(lh / step))
 const maxS = Math.max(0, wxResults.length - vis), sc = Math.min(wxScroll, maxS)
 ctx.save(); ctx.rectangle(x - 2, ly - 2, w + 4, lh + 4); ctx.clip()
 for (let i = 0; i <= vis; i++) {
 const idx = sc + i; if (idx >= wxResults.length) break
 const r = wxResults[idx], ry = ly + i * step; if (ry + rowH > ly + lh + step) break
 aPath(ctx, x, ry, w, rowH, 5); ctx.setSourceRGBA(RED[0] * 0.16, RED[1] * 0.08, RED[2] * 0.08, 0.34); ctx.fill()
 aPath(ctx, x, ry, w, rowH, 5); ctx.setSourceRGBA(RED[0], RED[1], RED[2], 0.6); ctx.setLineWidth(0.9); ctx.stroke()
 gpango(ctx, x + 14, ry + rowH / 2 + 4, r.full, GTITLE, true, 11, RACC, 0.95)
 g.push({ kind: "row", bx0: x, by0: ry, bx1: x + w, by1: ry + rowH, on: () => wxPick(r) })
 }
 ctx.restore()
 gtxt(ctx, x, g.Y + g.h - 10, "type ▸ click a result · ESC cancels", GMONO, 8, RED, 0.42)
 },
 })
}
export const openCityModal = () => { ensureWxModal(); wxModal.toggle() }

let fcModal: any = null, fcSel = 0, fcTick = 0, fcOpenAt = 0, fcCityTap = 0
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
const fcReveal = () => ease((Date.now() - fcOpenAt) / 620)

const YEL: [number, number, number] = USER.amber
const ARA: [number, number, number] = RACC
const HOT: [number, number, number] = USER.red

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
const ghost = (ctx, x, y, s, font, size, a = 0.4) => {
 gtxt(ctx, x - 2, y + 1.2, s, font, size, HOT, a, 1)
}

const fcCard = (ctx, g, d, i, x, y, w, h, sel, rv) => {
 const col = sel ? YEL : ARA
 chamfer(ctx, x, y, w, h, 12)
 ctx.setSourceRGBA(col[0] * 0.22, col[1] * 0.3, col[2] * 0.36, sel ? 0.26 : 0.09); ctx.fill()
 chamfer(ctx, x, y, w, h, 12)
 ctx.setSourceRGBA(col[0], col[1], col[2], sel ? 0.95 : 0.26); ctx.setLineWidth(sel ? 1.4 : 0.9); ctx.stroke()
 if (sel) { ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.72 + 0.28 * Math.sin(fcTick / 7)); ctx.rectangle(x, y, w, 3); ctx.fill() }
 const cw2 = (s, font, size, bold) => { ctx.selectFontFace(font, 0, bold ? 1 : 0); ctx.setFontSize(size); return ctx.textExtents(s).width }
 const fit = (s, font, size, bold, max) => { let sz = size; while (sz > 8 && cw2(s, font, sz, bold) > max) sz -= 0.5; return sz }
 gtxt(ctx, x + 5, y + 15, `0${i + 1}`, GMONO, 7, sel ? YEL : ARA, sel ? 0.75 : 0.35)
 gtxt(ctx, x + w / 2 - cw2(d ? d.day : "--", GTITLE, 12, true) / 2, y + 30, d ? d.day : "--", GTITLE, 12, sel ? YEL : ARA, sel ? 1 : 0.75, 1, sel ? 0.45 : 0)
 gtxt(ctx, x + w / 2 - cw2(d ? d.date : "", GMONO, 8.5, true) / 2, y + 43, d ? d.date : "", GMONO, 8.5, sel ? YEL : ARA, sel ? 0.95 : 0.72, 1)
 if (!d) return
 gpango(ctx, x + w / 2 - 13, y + 76, wxIcon(WMO[d.code] || ""), ICONF, false, 25, sel ? YEL : ARA, sel ? 0.98 : 0.6)
 const hs = fit(d.hi, GTITLE, 17, true, w - 14), hw = cw2(d.hi, GTITLE, hs, true)
 if (sel) ghost(ctx, x + w / 2 - hw / 2, y + 102, d.hi, GTITLE, hs, 0.45)
 gtxt(ctx, x + w / 2 - hw / 2, y + 102, d.hi, GTITLE, hs, sel ? YEL : ARA, 0.97, 1, sel ? 0.4 : 0)
 gtxt(ctx, x + w / 2 - cw2(d.lo, GMONO, 10, false) / 2, y + 117, d.lo, GMONO, 10, ARA, 0.5)
 const segs = 7, sh = 4, sg = 2, bx = x + 8, bw = w - 16
 const on = Math.round((d.pop / 100) * segs * rv)
 const sw2 = (bw - sg * (segs - 1)) / segs
 for (let s = 0; s < segs; s++) {
 const lit = s < on
 ctx.setSourceRGBA(lit ? YEL[0] : ARA[0], lit ? YEL[1] : ARA[1], lit ? YEL[2] : ARA[2], lit ? 0.92 : 0.13)
 ctx.rectangle(bx + s * (sw2 + sg), y + h - 26, sw2, sh); ctx.fill()
 }
 gtxt(ctx, x + w / 2 - cw2(`${d.pop}%`, GMONO, 7.5, false) / 2, y + h - 10, `${d.pop}%`, GMONO, 7.5, d.pop > 0 ? YEL : ARA, d.pop > 0 ? 0.8 : 0.45)
}

const fcCurve = (ctx, days, x, y, w, h, rv) => {
 if (days.length < 2) return
 const his = days.map(d => d.hiN), los = days.map(d => d.loN)
 const mx = Math.max(...his) + 2, mn = Math.min(...los) - 2, rg = Math.max(1, mx - mn)
 const px = (i) => x + (i / (days.length - 1)) * w
 const py = (v) => y + h - ((v - mn) / rg) * h
 const n = Math.max(2, Math.ceil(days.length * rv))
 ctx.newPath(); ctx.moveTo(px(0), y + h)
 for (let i = 0; i < n; i++) ctx.lineTo(px(i), py(his[i]))
 ctx.lineTo(px(n - 1), y + h); ctx.closePath()
 ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.07); ctx.fill()
 ctx.setSourceRGBA(ARA[0], ARA[1], ARA[2], 0.16); ctx.setLineWidth(0.8)
 for (let i = 0; i < n; i++) { ctx.newPath(); ctx.moveTo(px(i), py(his[i])); ctx.lineTo(px(i), y + h); ctx.stroke() }
 for (const [vals, cc, aa, lw] of [[los, ARA, 0.5, 1.2], [his, YEL, 0.95, 1.9]] as any) {
 ctx.newPath()
 for (let i = 0; i < n; i++) { const X = px(i), Y = py(vals[i]); i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y) }
 ctx.setSourceRGBA(cc[0], cc[1], cc[2], aa); ctx.setLineWidth(lw); ctx.stroke()
 for (let i = 0; i < n; i++) {
 const X = px(i), Y = py(vals[i])
 ctx.setSourceRGBA(cc[0], cc[1], cc[2], aa)
 ctx.rectangle(X - 2.4, Y - 2.4, 4.8, 4.8); ctx.fill()
 }
 }
 gtxt(ctx, x - 12, y + 6, `${Math.round(mx)}`, GMONO, 7, ARA, 0.4)
 gtxt(ctx, x - 12, y + h, `${Math.round(mn)}`, GMONO, 7, ARA, 0.4)
}

const ensureForecastModal = () => {
 if (fcModal) return
 fcModal = createModal({
 name: "forecast", tabTitle: "ATMOSPHERIC UPLINK · 7-DAY", W: 940, H: 480,
 col: RED, accent: YEL, yaw: -29, pitch: -5, roll: -0.4, focal: 2400, dist: 2300, glass: 0.88, anchorLeft: true, keymode: Keymode.ON_DEMAND,
 onOpen: () => { fcSel = 0; fcTick = 0; fcOpenAt = Date.now(); refreshWeather() },
 onFrame: () => { fcTick++; fcModal.requestDraw() },
 onKey: (k) => {
 if (k === Gdk.KEY_Left) fcSel = Math.max(0, fcSel - 1)
 else if (k === Gdk.KEY_Right) fcSel = Math.min(Math.max(0, forecast.length - 1), fcSel + 1)
 else return
 fcModal.requestDraw()
 },
 draw: (ctx, g) => {
 const rv = fcReveal(), d = forecast[fcSel]
 const x0 = g.X + 18, y0 = g.Y + GHEAD + 6, lw = 250
 gtxt(ctx, x0, y0 + 12, (geoCity || wxName || "NIGHT CITY").slice(0, 34).toUpperCase(), GTITLE, 11, YEL, 0.95, 1, 0.35)
 gtxt(ctx, x0, y0 + 27, geoCoords, GMONO, 8, ARA, 0.45)
 g.push({ kind: "city", bx0: x0 - 6, by0: y0 - 2, bx1: x0 + lw, by1: y0 + 32, on: () => {
 const t = Date.now()
 if (t - fcCityTap < 450) { fcCityTap = 0; fcModal.close(); openCityModal() } else fcCityTap = t
 } })

 chamfer(ctx, x0, y0 + 36, lw, 128, 14)
 ctx.setSourceRGBA(ARA[0] * 0.24, ARA[1] * 0.34, ARA[2] * 0.42, 0.16); ctx.fill()
 hatch(ctx, x0 + lw - 54, y0 + 36, 54, 26, ARA, 0.10)
 chamfer(ctx, x0, y0 + 36, lw, 128, 14)
 ctx.setSourceRGBA(ARA[0], ARA[1], ARA[2], 0.42); ctx.setLineWidth(1); ctx.stroke()
 bracket(ctx, x0 + 4, y0 + 40, lw - 8, 120, YEL, 0.5)
 if (d) {
 gpango(ctx, x0 + 16, y0 + 104, wxIcon(WMO[d.code] || ""), ICONF, false, 46, YEL, 0.95)
 ghost(ctx, x0 + 88, y0 + 100, d.hi, GTITLE, 44, 0.4)
 gpango(ctx, x0 + 88, y0 + 100, d.hi, GTITLE, true, 44, YEL, 0.98)
 gtxt(ctx, x0 + 88, y0 + 122, `LOW ${d.lo}`, GMONO, 10, ARA, 0.6)
 gtxt(ctx, x0 + 16, y0 + 132, (WMO[d.code] || "—").toUpperCase(), GTITLE, 11, ARA, 0.8, 1)
 gtxt(ctx, x0 + 16, y0 + 152, `${d.day} · ${d.date}`, GMONO, 9, ARA, 0.5)
 }
 const rows: [string, string][] = d ? [
 ["PRECIPITATION", `${d.pop}%`], ["WIND MAX", `${d.wind} km/h`], ["UV INDEX", `${d.uv}`],
 ["SUNRISE", d.sunrise || "--:--"], ["SUNSET", d.sunset || "--:--"],
 ] : []
 let ry = y0 + 186
 for (const [k, v] of rows) {
 ctx.setSourceRGBA(ARA[0], ARA[1], ARA[2], 0.14)
 ctx.newPath(); ctx.moveTo(x0, ry + 6); ctx.lineTo(x0 + lw, ry + 6); ctx.setLineWidth(1); ctx.stroke()
 ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.55)
 ctx.rectangle(x0, ry - 6, 2, 8); ctx.fill()
 gtxt(ctx, x0 + 8, ry, k, GMONO, 9, ARA, 0.55)
 gtxt(ctx, x0 + lw - ctx.textExtents(v).width, ry, v, GTITLE, 11, YEL, 0.92, 1)
 ry += 24
 }
 ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.85)
 ctx.rectangle(x0, y0 + 308, 22, 2); ctx.fill()
 gtxt(ctx, x0 + 28, y0 + 312, "// LIVE", GMONO, 8, YEL, 0.7)
 gtxt(ctx, x0, y0 + 334, `${wxTemp}  ${wxDesc.toUpperCase()}`, GTITLE, 13, YEL, 0.9, 1, 0.25)
 gtxt(ctx, x0, y0 + 350, `FEELS ${wxFeels} · HUM ${wxHum}% · WIND ${wxWind}`, GMONO, 8.5, ARA, 0.5)

 const rx = x0 + lw + 26, rw = (g.X + g.w) - rx - 18
 const cw = rw / 7, ch = 182
 for (let i = 0; i < 7; i++) {
 const cx = rx + i * cw + 3, d2 = forecast[i]
 fcCard(ctx, g, d2, i, cx, y0 + 10, cw - 6, ch, i === fcSel, rv)
 g.push({ kind: "day", bx0: cx, by0: y0 + 10, bx1: cx + cw - 6, by1: y0 + 10 + ch, on: () => { fcSel = i; fcModal.requestDraw() } })
 }
 const gy = y0 + ch + 34, gh = 140
 ctx.setSourceRGBA(YEL[0], YEL[1], YEL[2], 0.85)
 ctx.rectangle(rx, gy - 14, 14, 2); ctx.fill()
 gtxt(ctx, rx + 20, gy - 10, "// THERMAL TREND · 7 DAYS", GMONO, 8.5, YEL, 0.7)
 ctx.setSourceRGBA(ARA[0], ARA[1], ARA[2], 0.07)
 for (let i = 0; i <= 4; i++) { const yy = gy + (gh / 4) * i; ctx.newPath(); ctx.moveTo(rx, yy); ctx.lineTo(rx + rw - 6, yy); ctx.setLineWidth(1); ctx.stroke() }
 fcCurve(ctx, forecast, rx + 14, gy, rw - 34, gh, rv)
 gtxt(ctx, g.X + 18, g.Y + g.h - 10, "click a day · double-click the city to change it · ESC closes", GMONO, 8, ARA, 0.45)
 },
 })
}
export const openForecastModal = () => { ensureForecastModal(); fcModal.toggle() }
