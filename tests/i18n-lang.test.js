import test from 'node:test';
import assert from 'node:assert/strict';

const LANG_OPTS = ["en", "ru", "fr", "es", "pt", "de", "sv", "ja", "zh", "ko", "ar", "it", "tr", "pl", "cz"];
const LANG_LABEL = { en: "ENGLISH", ru: "RUSSIAN", fr: "FRENCH", es: "SPANISH", pt: "PORTUGUESE", de: "GERMAN", sv: "SWEDISH", ja: "JAPANESE", zh: "CHINESE", ko: "KOREAN", ar: "ARABIC", it: "ITALIAN", tr: "TURKISH", pl: "POLISH", cz: "CZECH" };

test('lang options are single valid codes, no multi-language strings', () => {
  for (const l of LANG_OPTS) {
    assert.match(l, /^[a-z]{2,5}$/, `bad lang code: ${l}`);
    assert.ok(!l.includes(",") && !l.includes(" "), `lang must be single, got: ${l}`);
  }
  assert.equal(new Set(LANG_OPTS).size, LANG_OPTS.length, "duplicate lang entries");
});

test('en is the not-managed sentinel default', () => {
  assert.equal(LANG_OPTS[0], "en");
  assert.equal(LANG_LABEL["en"], "ENGLISH");
});
