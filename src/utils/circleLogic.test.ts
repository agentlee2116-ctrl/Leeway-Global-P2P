/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CIRCLELOGIC_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\circleLogic.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/circleLogic.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  addVoiceBurst,
  addTextMessage,
  addVideoSnap,
  flushOfflineQueue,
  filterByCircle,
  countQueuedItems,
  validateCircleSetup,
  toggleItemReaction,
  generateDeviceFingerprint,
  generateCircleCode,
  INITIAL_VOICE_BURSTS,
  INITIAL_TEXT_DISPATCHES,
  INITIAL_VIDEO_SNAPS,
} from './circleLogic';

test('formatDuration formats seconds into mm:ss and clamps negative values', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(9), '00:09');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(-4), '00:00');
});

test('addVoiceBurst prepends burst with queued state matching offline flag', () => {
  const updated = addVoiceBurst(INITIAL_VOICE_BURSTS, {
    circleId: 'LW-MKE-01',
    sender: 'Leonard J. Lee (You)',
    durationSec: 7,
    offline: true,
  });
  assert.equal(updated.length, INITIAL_VOICE_BURSTS.length + 1);
  assert.equal(updated[0].durationLabel, '00:07');
  assert.equal(updated[0].queued, true);
  assert.equal(updated[0].circleId, 'LW-MKE-01');
});

test('addTextMessage rejects empty whitespace and prepends valid text', () => {
  const rejected = addTextMessage(INITIAL_TEXT_DISPATCHES, {
    circleId: 'LW-MKE-01',
    sender: 'Leonard',
    body: '   ',
    offline: false,
  });
  assert.equal(rejected.ok, false);

  const accepted = addTextMessage(INITIAL_TEXT_DISPATCHES, {
    circleId: 'LW-MKE-01',
    sender: 'Leonard',
    body: '  Arrived safely!  ',
    offline: true,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.messages[0].body, 'Arrived safely!');
    assert.equal(accepted.messages[0].queued, true);
  }
});

test('flushOfflineQueue clears queued flags across lists', () => {
  const voices = addVoiceBurst(INITIAL_VOICE_BURSTS, {
    circleId: 'LW-MKE-01',
    sender: 'Leonard',
    durationSec: 4,
    offline: true,
  });
  const textRes = addTextMessage(INITIAL_TEXT_DISPATCHES, {
    circleId: 'LW-MKE-01',
    sender: 'Leonard',
    body: 'Offline note',
    offline: true,
  });
  const texts = textRes.ok ? textRes.messages : INITIAL_TEXT_DISPATCHES;
  const snapRes = addVideoSnap(INITIAL_VIDEO_SNAPS, {
    circleId: 'LW-MKE-01',
    title: 'Quick porch check',
    sender: 'Leonard',
    durationSec: 8,
    thumbnailUrl: './src/assets/images/lakefront_snap_1795518767950.jpg',
    offline: true,
  });
  const snaps = snapRes.ok ? snapRes.snaps : INITIAL_VIDEO_SNAPS;

  assert.equal(countQueuedItems(voices, texts, snaps), 3);

  const flushedVoices = flushOfflineQueue(voices);
  const flushedTexts = flushOfflineQueue(texts);
  const flushedSnaps = flushOfflineQueue(snaps);

  assert.equal(countQueuedItems(flushedVoices, flushedTexts, flushedSnaps), 0);
});

test('filterByCircle isolates messages to active circle', () => {
  const mkeVoices = filterByCircle(INITIAL_VOICE_BURSTS, 'LW-MKE-01');
  assert.equal(mkeVoices.every((v) => v.circleId === 'LW-MKE-01'), true);
  assert.equal(mkeVoices.length, 2);
});

test('validateCircleSetup normalizes valid input and rejects invalid IDs', () => {
  const badName = validateCircleSetup('L', 'LW-MKE-01');
  assert.equal(badName.ok, false);

  const badId = validateCircleSetup('Leonard', 'bad id!');
  assert.equal(badId.ok, false);

  const good = validateCircleSetup(' Leonard Lee ', 'lw-fam-09');
  assert.deepEqual(good, {
    ok: true,
    displayName: 'Leonard Lee',
    circleId: 'LW-FAM-09',
  });
});

test('toggleItemReaction increments emoji reaction count for matching item', () => {
  const first = toggleItemReaction(INITIAL_VIDEO_SNAPS, 'vs-1', '❤️');
  assert.equal(first[0].reactions?.['❤️'], 1);
  const second = toggleItemReaction(first, 'vs-1', '❤️');
  assert.equal(second[0].reactions?.['❤️'], 2);
});

test('generateDeviceFingerprint and generateCircleCode produce valid formatted strings', () => {
  const fp = generateDeviceFingerprint(42);
  assert.match(fp, /^ED25519 · [0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  const code = generateCircleCode(17);
  assert.match(code, /^LW-[A-Z]{3}-\d{2}$/);
  assert.equal(validateCircleSetup('Leonard', code).ok, true);
});

