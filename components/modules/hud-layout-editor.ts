import Gtk from 'gi://Gtk?version=3.0'
import Gdk from 'gi://Gdk?version=3.0'
import { hudLayout, saveHudLayout } from './hud-layout.ts'
import { COMPONENTS, ANCHORS, layoutProfile } from './hud-layout-policy.js'

let opened: any = null
// A regular GTK window: keyboard input and focus are handled natively, not by canvas hit tests.
export function createHudLayoutEditor() {
 let draft = JSON.parse(JSON.stringify(hudLayout()))
 const win = new Gtk.Window({ title: 'CyberArch HUD Layout', default_width: 740, default_height: 520 })
 const outer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12, margin: 16 })
 win.add(outer)
 const profiles = new Gtk.ComboBoxText()
 for (const p of ['Minimal', 'Balanced', 'Cinematic', 'Custom']) profiles.append(p, p)
 profiles.set_name('hud-profile')
 profiles.set_active_id(draft.profile)
 outer.pack_start(profiles, false, false, 0)
 const scaleRow = new Gtk.Box({ spacing: 12 })
 scaleRow.pack_start(new Gtk.Label({ label: 'Global scale (persistent HUD only)' }), false, false, 0)
 const number = (name, value, min, max, step) => {
  const widget = Gtk.SpinButton.new_with_range(min, max, step)
  widget.set_name(name); widget.set_digits(step < 1 ? 2 : 0); widget.set_value(value)
  return widget
 }
 const global = number('hud-global-scale', draft.globalScale, 0.25, 2, 0.01)
 scaleRow.pack_start(global, false, false, 0); outer.pack_start(scaleRow, false, false, 0)
 const grid = new Gtk.Grid({ row_spacing: 10, column_spacing: 12 })
 outer.pack_start(grid, true, true, 0)
 const status = new Gtk.Label({ label: 'Offsets are scaled design units. Layout applies to each monitor; windows clamp to its edges.', wrap: true, xalign: 0 })
 const rows = {}
 const custom = () => { draft.profile = 'Custom'; profiles.set_active_id('Custom') }
 const render = () => {
  global.set_value(draft.globalScale)
  for (const name of COMPONENTS) {
   const c = draft.components[name], r = rows[name]
   r.visible.set_active(c.visible); r.scale.set_value(c.scale); r.anchor.set_active_id(c.anchor); r.x.set_value(c.x); r.y.set_value(c.y)
  }
 }
 ;['Component', 'Visible', 'Scale', 'Corner', 'X offset', 'Y offset'].forEach((label, col) => grid.attach(new Gtk.Label({ label }), col, 0, 1, 1))
 COMPONENTS.forEach((name, i) => {
  const c = draft.components[name]
  const visible = new Gtk.CheckButton(); visible.set_name(`hud-${name}-visible`)
  const scale = number(`hud-${name}-scale`, c.scale, 0.25, 2, 0.01)
  const anchor = new Gtk.ComboBoxText(); anchor.set_name(`hud-${name}-anchor`)
  ANCHORS.forEach(a => anchor.append(a, a))
  const x = number(`hud-${name}-x`, c.x, 0, 10000, 1), y = number(`hud-${name}-y`, c.y, 0, 10000, 1)
  rows[name] = { visible, scale, anchor, x, y }
  ;[new Gtk.Label({ label: name, xalign: 0 }), visible, scale, anchor, x, y].forEach((w, col) => grid.attach(w, col, i + 1, 1, 1))
 })
 render()
 profiles.connect('changed', () => {
  const id = profiles.get_active_id()
  if (id && id !== 'Custom') { draft = layoutProfile(id); render() }
 })
 const actions = new Gtk.Box({ spacing: 12 })
 const apply = new Gtk.Button({ label: 'Apply' }); apply.set_name('hud-apply')
 const discard = new Gtk.Button({ label: 'Discard / Close' }); discard.set_name('hud-discard')
 apply.connect('clicked', () => {
  apply.set_sensitive(false)
  try {
   draft.globalScale = global.get_value()
   for (const name of COMPONENTS) {
    const r = rows[name]
    draft.components[name] = { visible: r.visible.get_active(), scale: r.scale.get_value(), anchor: r.anchor.get_active_id(), x: r.x.get_value(), y: r.y.get_value() }
   }
   // Preserve a selected profile only when every control still matches it.
   if (draft.profile !== 'Custom' && JSON.stringify(draft) !== JSON.stringify(layoutProfile(draft.profile))) custom()
   saveHudLayout(draft); status.set_text('Saved. Persistent HUD windows refreshed; modal scaling is unchanged.')
  } catch (e) { status.set_text(`Not applied: ${e}`) }
  finally { apply.set_sensitive(true) }
 })
 discard.connect('clicked', () => win.destroy())
 actions.pack_end(apply, false, false, 0); actions.pack_end(discard, false, false, 0)
 outer.pack_start(status, false, false, 0); outer.pack_start(actions, false, false, 0)
 win.connect('key-press-event', (_w, event) => { if (event.get_keyval()[1] === Gdk.KEY_Escape) { win.destroy(); return true } return false })
 return win
}
export function openHudLayoutEditor() {
 if (opened) { opened.present(); return }
 opened = createHudLayoutEditor()
 opened.connect('destroy', () => { opened = null })
 opened.show_all(); opened.present()
}
