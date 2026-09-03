import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"


export const HOME = GLib.get_home_dir()
export const CYBER_DIR = `${HOME}/.config/hypr/themes/cyberpunk`
export const COMPONENTS_DIR = `${CYBER_DIR}/components`
export const USER_DIR = `${HOME}/.local/share/cyberdeck`
export const USER_LUA = `${HOME}/.config/hypr/user.lua`
GLib.mkdir_with_parents(USER_DIR, 0o755)
const display = Gdk.Display.get_default()!
const monitor = display.get_primary_monitor() ?? display.get_monitor(0)!
const geo = monitor.get_geometry()
export const SCREEN_WIDTH = geo.width
export const SCREEN_HEIGHT = geo.height
