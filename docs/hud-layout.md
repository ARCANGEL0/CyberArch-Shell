# Persistent HUD layout

Theme Settings → Configuration → **HUD Profiles / Component Layout** opens a
native GTK editor. No additional shortcut or desktop-service integration is added.
Minimal keeps the two docks and launcher. Balanced keeps all six surfaces at
0.75 global scale. Cinematic uses full presentation scale. Editing a profile
marks it Custom. Existing installations without a layout use Cinematic.

`$XDG_CONFIG_HOME/cyberarch/hud-layout.json` is a version-1 native preference.
Each of monitors, sidepanel, markets, hordock, toggles and launcher has visibility,
scale, one of four corner anchors and nonnegative X/Y offsets in scaled design
units. The same preferences apply separately on every connected monitor.

Apply validates the whole document and atomically replaces it with Gio (retaining
a previous-file backup). Discard/closing writes nothing. Invalid saved input is
reported and the process uses defaults without rewriting the invalid file.
Live Apply rebuilds only persistent HUD windows. Hidden factories are not called,
so hidden surfaces have no window or input region. Per-window provider timers
are canceled during rebuild. Full-screen modals do not receive HUD scaling.

Scale is upstream logical-monitor scale × global × component, once, capped to
fit that component's projected footprint. Offsets clamp to remaining logical
monitor space. Custom components may overlap each other; automatic collision
resolution and a drag canvas are not implemented. The default vertical-dock
negative margin is normalized to zero to avoid drawing outside the monitor.

Validation: `node tests/hud-layout.test.js`, `bash tests/hud-layout-widget.sh`,
and `ags bundle --gtk 3 core.ts /tmp/cyberarch-layout-check`.
The widget test runs real GTK controls with temporary preferences and a Wayland
backend, not the desktop takeover entrypoint. Physical multi-monitor hotplug and
end-to-end full-shell input-region rendering remain optional manual qualification.
