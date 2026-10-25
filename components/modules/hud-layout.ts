import GLib from 'gi://GLib'
import Gio from 'gi://Gio'
import { layoutProfile, validateLayout, fitPlacement } from './hud-layout-policy.js'
import { Anchor } from './widget.ts'

const path = `${GLib.get_user_config_dir()}/cyberarch/hud-layout.json`
let current = layoutProfile()
try {
 if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
  const [ok, data] = GLib.file_get_contents(path)
  if (ok) current = validateLayout(JSON.parse(new TextDecoder().decode(data)))
 }
} catch (e) { print(`[hud-layout] using default layout: ${e}`) }
const listeners = new Set<() => void>()
export const hudLayout = () => current
export const onHudLayout = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb) }
export function saveHudLayout(value) {
 const next = validateLayout(value)
 GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700)
 Gio.File.new_for_path(path).replace_contents(JSON.stringify(next, null, 2), null, true, Gio.FileCreateFlags.REPLACE_DESTINATION, null)
 current = next
 for (const cb of listeners) cb()
}
export function placeHudWindow(win, mon, name, scale) {
 const apply = () => {
  const c = current.components[name]
  const [minimum, natural] = win.get_preferred_size()
  const size = { width: Math.max(minimum.width, natural.width), height: Math.max(minimum.height, natural.height) }
  const p = fitPlacement(c, mon.get_geometry(), size, scale)
  win.anchor = (p.anchor.startsWith('top') ? Anchor.TOP : Anchor.BOTTOM) | (p.anchor.endsWith('left') ? Anchor.LEFT : Anchor.RIGHT)
  win.margin_left = p.anchor.endsWith('left') ? p.x : 0
  win.margin_right = p.anchor.endsWith('right') ? p.x : 0
  win.margin_top = p.anchor.startsWith('top') ? p.y : 0
  win.margin_bottom = p.anchor.startsWith('bottom') ? p.y : 0
 }
 apply()
 win.connect('size-allocate', apply)
}
