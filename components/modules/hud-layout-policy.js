export const COMPONENTS = ['monitors', 'sidepanel', 'markets', 'hordock', 'toggles', 'launcher']
export const ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const placement = {
 monitors: ['top-left', 20, 20], sidepanel: ['top-right', 28, 26],
 markets: ['top-right', 0, 560], hordock: ['bottom-left', 0, 0],
 toggles: ['bottom-left', 0, 0], launcher: ['bottom-right', 3, 0],
}
export function layoutProfile(profile = 'Cinematic') {
 if (!['Minimal', 'Balanced', 'Cinematic'].includes(profile)) throw Error('Unknown profile')
 return { version: 1, profile, globalScale: profile === 'Balanced' ? 0.75 : 1,
  components: Object.fromEntries(COMPONENTS.map(name => {
   const [anchor, x, y] = placement[name]
   return [name, { visible: profile !== 'Minimal' || ['hordock', 'toggles', 'launcher'].includes(name), scale: 1, anchor, x, y }]
  })) }
}
export function createSurfaces(layout, create) {
 return COMPONENTS.filter(name => layout.components[name].visible).map(name => create(name))
}
export function componentScale(base, layout, name) {
 return name ? base * layout.globalScale * layout.components[name].scale : base
}
export function fitScale(requested, monitor, size) {
 return Math.min(requested, monitor.width / size.width, monitor.height / size.height)
}
export function fitPlacement(component, monitor, size, scale) {
 return { anchor: component.anchor,
  x: Math.round(Math.max(0, Math.min(component.x * scale, monitor.width - size.width))),
  y: Math.round(Math.max(0, Math.min(component.y * scale, monitor.height - size.height))) }
}
export function validateLayout(value) {
 const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
 if (!value || value.version !== 1 || !['Minimal', 'Balanced', 'Cinematic', 'Custom'].includes(value.profile)
  || !number(value.globalScale, 0.25, 2)) throw Error('Invalid HUD layout or global scale (0.25–2)')
 const result = { version: 1, profile: value.profile, globalScale: value.globalScale, components: {} }
 for (const name of COMPONENTS) {
  const c = value.components?.[name]
  if (!c || typeof c.visible !== 'boolean' || !number(c.scale, 0.25, 2) || !ANCHORS.includes(c.anchor)
   || !number(c.x, 0, 10000) || !number(c.y, 0, 10000)) throw Error(`Invalid ${name} layout`)
  result.components[name] = { visible: c.visible, scale: c.scale, anchor: c.anchor, x: c.x, y: c.y }
 }
 return result
}
