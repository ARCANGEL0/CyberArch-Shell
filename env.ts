import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"


export const HOME = GLib.get_home_dir()
export const CYBER_DIR = SRC
export const CONFIG_DIR = `${GLib.get_user_config_dir()}/cyberarch`
GLib.mkdir_with_parents(CONFIG_DIR, 0o755)
export const COMPONENTS_DIR = `${CYBER_DIR}/components`
const display = Gdk.Display.get_default()!
const monitor = display.get_primary_monitor() ?? display.get_monitor(0)!
const geo = monitor.get_geometry()
export const SCREEN_WIDTH = geo.width
export const SCREEN_HEIGHT = geo.height
