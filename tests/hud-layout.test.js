import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutProfile, createSurfaces, componentScale, validateLayout, fitPlacement, fitScale } from '../components/modules/hud-layout-policy.js'

test('Minimal never constructs hidden surfaces, leaving no hidden input windows', () => {
 const made = []
 const surfaces = createSurfaces(layoutProfile('Minimal'), name => { made.push(name); return name })
 assert.deepEqual(surfaces, ['hordock', 'toggles', 'launcher'])
 assert.deepEqual(made, ['hordock', 'toggles', 'launcher'])
})

test('placement fits logical monitor bounds including oversized components', () => {
 const c = { anchor: 'bottom-right', x: 2000, y: 50 }
 assert.deepEqual(fitPlacement(c, { width: 1152, height: 648 }, { width: 300, height: 200 }, 0.5),
  { anchor: 'bottom-right', x: 852, y: 25 })
 assert.deepEqual(fitPlacement(c, { width: 100, height: 80 }, { width: 300, height: 200 }, 1),
  { anchor: 'bottom-right', x: 0, y: 0 })
})
test('oversized persistent components shrink to fit a logical monitor, without upscaling small ones', () => {
 assert.equal(fitScale(2, { width: 1152, height: 648 }, { width: 400, height: 600 }), 1.08)
 assert.equal(fitScale(0.4, { width: 1152, height: 648 }, { width: 400, height: 600 }), 0.4)
})

test('monitor, global and component scaling compose once, and invalid layouts are rejected', () => {
 const layout = layoutProfile('Balanced')
 layout.globalScale = 0.67
 layout.components.sidepanel.scale = 0.8
 assert.ok(Math.abs(componentScale(0.6, layout, 'sidepanel') - 0.3216) < 1e-12)
 assert.equal(componentScale(0.6, layout), 0.6) // full-screen modals are unaffected
 assert.equal(validateLayout(layout).globalScale, 0.67)
 for (const bad of [NaN, Infinity, -1, 0, 4]) {
  assert.throws(() => validateLayout({ ...layout, globalScale: bad }))
 }
 layout.components.sidepanel.anchor = 'middle'
 assert.throws(() => validateLayout(layout))
})
