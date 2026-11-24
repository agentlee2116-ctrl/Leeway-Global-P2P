/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.I18N_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\i18n.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/i18n.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { I18N, isRtlLang, LANGUAGE_LIST } from './i18n';

test('all listed languages have complete non-empty translations', () => {
  assert.ok(LANGUAGE_LIST.length >= 20);
  const baseKeys = Object.keys(I18N.en) as Array<keyof typeof I18N.en>;
  for (const item of LANGUAGE_LIST) {
    const bundle = I18N[item.code];
    assert.ok(bundle, `Missing bundle for ${item.code}`);
    for (const key of baseKeys) {
      assert.equal(typeof bundle[key], 'string', `Missing key ${key} for ${item.code}`);
      assert.ok(bundle[key].trim().length > 0, `Empty key ${key} for ${item.code}`);
    }
  }
});

test('RTL detection handles Arabic and Urdu cleanly', () => {
  assert.equal(isRtlLang('ar'), true);
  assert.equal(isRtlLang('ur'), true);
  assert.equal(isRtlLang('en'), false);
  assert.equal(isRtlLang('es'), false);
});
