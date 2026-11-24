/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TESTS_PLATFORM
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: OS-agnostic platform adapter and ordered PTT playback tests
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/platform.test.ts
WHY: Android, iOS, Windows, macOS, Linux and Web must share one dispatch core with honest fallbacks
HOW: Deterministic unit tests with injected player; no physical OS claim
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectOs, detectPlatform, FallbackPlatform, OrderedPlaybackQueue, supportedMimeTypes,
} from '../src/platform/index.ts';

test('OS detection is reported without making any OS canonical', () => {
  assert.equal(detectOs('Mozilla/5.0 (Linux; Android 14)', ''), 'android');
  assert.equal(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', ''), 'ios');
  assert.equal(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ''), 'windows');
  assert.equal(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', ''), 'macos');
  assert.equal(detectOs('Mozilla/5.0 (X11; Linux x86_64)', ''), 'linux');
  assert.equal(detectOs('', ''), 'unknown');
});

test('Node/non-browser runtime gets an honest fallback adapter', async () => {
  const platform = detectPlatform();
  assert.ok(platform instanceof FallbackPlatform);
  const caps = platform.capabilities();
  assert.equal(caps.mediaCapture, false);
  assert.equal(caps.persistence, 'memory');
  assert.equal(caps.physicalVerification, 'NOT VERIFIED');
  await assert.rejects(() => platform.captureAudio(), /not available/);
  await assert.rejects(() => platform.captureVideo(), /not available/);
  assert.equal(platform.preferredAudioMime(), undefined);
  const room = await platform.openPrivateRoom(3);
  assert.equal(room.participants, 3);
  room.close();
});

test('mime negotiation returns a deterministic candidate list', () => {
  const audio = supportedMimeTypes('audio');
  const video = supportedMimeTypes('video');
  assert.ok(audio.length > 0);
  assert.ok(video.length > 0);
  assert.ok(audio[0].startsWith('audio/'));
  assert.ok(video[0].startsWith('video/'));
});

test('PTT playback is ordered, serial and restartable', async () => {
  const events: string[] = [];
  let active = 0;
  const queue = new OrderedPlaybackQueue(async (id) => {
    active++;
    assert.equal(active, 1, 'only one burst may play at a time');
    events.push(`start:${id}`);
    await Promise.resolve();
    events.push(`end:${id}`);
    active--;
  });
  queue.enqueue('a'); queue.enqueue('b'); queue.enqueue('a'); queue.enqueue('c');
  assert.deepEqual(queue.pending, ['a', 'b', 'c']);
  const played = await queue.drain();
  assert.deepEqual(played, ['a', 'b', 'c']);
  assert.deepEqual(events, ['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
  assert.equal(queue.current, null);
  assert.equal(queue.pending.length, 0);
  queue.enqueue('d');
  assert.equal(await queue.advance(), 'd');
  queue.clear();
  assert.equal(queue.pending.length, 0);
});

test('fallback store preserves queued dispatch state', async () => {
  const platform = new FallbackPlatform();
  const store = platform.storage();
  await store.put({ message: { id: 'x', roomId: 'r', createdAt: 1 } as any, attempts: 0, status: 'queued' });
  assert.equal((await store.all('r')).length, 1);
  await store.delete('x');
  assert.equal((await store.all()).length, 0);
});
