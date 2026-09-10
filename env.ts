import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"


declare const SRC: string

export const HOME = GLib.get_home_dir()
export const CYBER_DIR = SRC
export const COMPONENTS_DIR = `${CYBER_DIR}/components`
export const USER_DIR = `${GLib.get_user_config_dir()}/cyberarch`
export const USER_LUA = `${HOME}/.config/hypr/user.lua`
export const WALLPAPERS_PATH = `${HOME}/Pictures/Wallpapers`
export const WALLPAPER_LUA = `${USER_DIR}/wallpaper.lua`
GLib.mkdir_with_parents(USER_DIR, 0o755)
GLib.mkdir_with_parents(WALLPAPERS_PATH, 0o755)
const display = Gdk.Display.get_default()!
const monitor = display.get_primary_monitor() ?? display.get_monitor(0)!
const geo = monitor.get_geometry()
export const SCREEN_WIDTH = geo.width
export const SCREEN_HEIGHT = geo.height

// ## Update: scalable HUD
// Instead hardcoded min/max setups, now the HUD is scalable according to screen HxW, adjusting its own size to make sure it maintains the same layout desing nevertheless the screen used

const scaleEnv = parseFloat(GLib.getenv("CYBER_SCALE") || "")
const autoScale = (w: number, h: number) => Math.min(w / 1920, h / 1080)
export const SCALE = scaleEnv > 0 ? scaleEnv : autoScale(SCREEN_WIDTH, SCREEN_HEIGHT)

export const scaleOf = (mon: any): number => {
 if (scaleEnv > 0) return scaleEnv
 try { const g = mon?.get_geometry?.(); if (g && g.width > 0 && g.height > 0) return autoScale(g.width, g.height) } catch {}
 return SCALE
}
export const winScale = (w: any): number => { try { return scaleOf((w as any)?.gdkmonitor) } catch { return SCALE } }
export const monW = (w: any): number => {
 try { const g = (w as any)?.gdkmonitor?.get_geometry?.(); if (g && g.width > 0) return g.width } catch {}
 return SCREEN_WIDTH
}
export const monH = (w: any): number => {
 try { const g = (w as any)?.gdkmonitor?.get_geometry?.(); if (g && g.height > 0) return g.height } catch {}
 return SCREEN_HEIGHT
}
