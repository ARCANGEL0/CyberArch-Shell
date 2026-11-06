import Gtk from 'gi://Gtk?version=3.0'
import GLib from 'gi://GLib'
import { createHudLayoutEditor } from '../components/modules/hud-layout-editor.ts'
import { hudLayout } from '../components/modules/hud-layout.ts'
import { createSurfaces, layoutProfile } from '../components/modules/hud-layout-policy.js'
Gtk.init(null)
const find = (w, name) => w.get_name() === name ? w : (w.get_children?.() || []).map(c => find(c, name)).find(Boolean)
const assert = (ok, message) => { if (!ok) throw Error(message) }
const win = createHudLayoutEditor(); win.show_all()
find(win, 'hud-profile').set_active_id('Minimal')
assert(!find(win, 'hud-sidepanel-visible').get_active(), 'profile updates real checkboxes')
const scale = find(win, 'hud-global-scale')
scale.set_text('0.67'); scale.update()
find(win, 'hud-launcher-anchor').set_active_id('top-left')
find(win, 'hud-launcher-x').set_value(25)
find(win, 'hud-apply').clicked()
assert(hudLayout().globalScale === 0.67, 'typed scale saved')
assert(hudLayout().profile === 'Custom', 'edited profile is custom')
assert(hudLayout().components.launcher.x === 25, 'offset saved')
find(win, 'hud-apply').clicked()
assert(hudLayout().globalScale === 0.67, 'repeated Apply is stable')
scale.set_value(1.2); find(win, 'hud-discard').clicked()
assert(hudLayout().globalScale === 0.67, 'Discard did not save draft')
const reopened = createHudLayoutEditor()
assert(find(reopened, 'hud-global-scale').get_value() === 0.67, 'reopen restores preferences')
reopened.destroy()
const windows = createSurfaces(layoutProfile('Minimal'), name => new Gtk.Window({ name }))
assert(windows.length === 3 && !windows.some(w => w.get_name() === 'sidepanel'), 'hidden component has no GTK window')
windows.forEach(w => w.destroy())
print('PASS: native layout inputs, profiles, Apply, repeat Apply, discard and hidden windows')
