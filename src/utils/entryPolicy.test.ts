/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.ENTRY_POLICY_TEST
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Static minimum-splash timing tests
WHY: Prevent fast device checks from skipping the mandatory 6-second logo screen
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/entryPolicy.test.ts
WHEN: 2026-11-24
HOW: Node built-in assertions using injected monotonic clock and sleeper
LICENSE: No new license asserted; preserve repository terms
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingSplashMs, holdSplashSince } from './entryPolicy.ts';

test('new launch waits at least six seconds', () => { assert.equal(remainingSplashMs(1000, 1000), 6000); });
test('completed enrollment check still holds remaining splash time', () => { assert.equal(remainingSplashMs(1000, 3100), 3900); });
test('slow enrollment check does not add delay', () => { assert.equal(remainingSplashMs(1000, 9000), 0); });
test('splash hold uses measured remaining interval', async () => {
  const calls: number[] = [];
  await holdSplashSince(100, () => 2050, async (delay) => { calls.push(delay); });
  assert.deepEqual(calls, [4050]);
});
