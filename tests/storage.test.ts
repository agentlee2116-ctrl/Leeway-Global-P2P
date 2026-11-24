/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.STORAGE_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: tests\storage.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/storage.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../src/core/crypto.ts';
import { createMessage } from '../src/core/messages.ts';
import {
  MemoryMessageStore, buildTransferBundle, expireStale, newQueued, parseTransferBundle,
} from '../src/core/storage.ts';

test('memory store queues, filters and deletes offline messages', async () => {
  const alice = await generateIdentity('Alice');
  const store = new MemoryMessageStore();
  const msg1 = await createMessage({ roomId: 'a', kind: 'text', from: alice.public.fingerprint, body: 'x', privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing });
  const msg2 = await createMessage({ roomId: 'b', kind: 'text', from: alice.public.fingerprint, body: 'y', privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing });
  await store.put(newQueued(msg1));
  await store.put(newQueued(msg2));
  assert.equal((await store.all()).length, 2);
  assert.equal((await store.all('a')).length, 1);
  assert.equal((await store.get(msg1.id))?.message.id, msg1.id);
  await store.delete(msg1.id);
  assert.equal((await store.all()).length, 1);
});

test('expired queued messages are marked expired, delivered ones are untouched', async () => {
  const alice = await generateIdentity('Alice');
  const msg = await createMessage({ roomId: 'a', kind: 'text', from: alice.public.fingerprint, body: 'x', ttlMs: 1000, privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing });
  const item = newQueued(msg);
  assert.equal(expireStale([item], msg.createdAt + 10)[0].status, 'queued');
  assert.equal(expireStale([item], msg.expiresAt + 1)[0].status, 'expired');
  assert.equal(expireStale([{ ...item, status: 'delivered' }], msg.expiresAt + 1)[0].status, 'delivered');
});

test('offline transfer bundle round trip and format validation', async () => {
  const alice = await generateIdentity('Alice');
  const msg = await createMessage({ roomId: 'a', kind: 'file', from: alice.public.fingerprint, body: 'YQ==', privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing });
  const attachment = { name: 'doc.txt', mime: 'text/plain', size: 2, encryptedBytes: 'e30=', sha256: 'abc' };
  const bundle = buildTransferBundle(msg, attachment, alice.public.fingerprint);
  const parsed = parseTransferBundle(bundle);
  assert.equal(parsed.sender, alice.public.fingerprint);
  assert.equal(parsed.attachment.name, 'doc.txt');
  assert.equal(parsed.message.id, msg.id);
  assert.throws(() => parseTransferBundle('{"format":"other"}'), /Not a LeeWay encrypted transfer bundle/);
});
