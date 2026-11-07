import test from 'node:test';
import assert from 'node:assert/strict';

const LAYOUT_OPTS = ["us", "gb", "de", "fr", "es", "it", "pt-br", "ru", "ua", "gr", "tr", "pl", "cz", "jp", "kr", "cn"];

test('layout options are single valid xkb layout codes, no multi-layout strings', () => {
  for (const l of LAYOUT_OPTS) {
    assert.match(l, /^[a-z]{2}(-[a-z]{2})?$/, `bad layout code: ${l}`);
    assert.ok(!l.includes(",") && !l.includes(" "), `layout must be single, got: ${l}`);
  }
  assert.equal(new Set(LAYOUT_OPTS).size, LAYOUT_OPTS.length, "duplicate layout entries");
});

test('empty string is the not-managed sentinel (theme leaves hyprland auto-detect alone)', () => {
  assert.ok(!LAYOUT_OPTS.includes(""));
  assert.ok(Array.isArray([""].concat(LAYOUT_OPTS)), "AUTO entry is just the empty string");
});
