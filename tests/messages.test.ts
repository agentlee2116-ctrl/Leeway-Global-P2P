/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.MESSAGES_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: tests\messages.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/messages.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../src/core/crypto.ts';
import {
  addAck, createAck, createMessage, deserializeMessage, isExpired,
  serializeMessage, verifyAck, verifyMessage,
} from '../src/core/messages.ts';

test('message signing and verification round trip', async () => {
  const alice = await generateIdentity('Alice');
  const msg = await createMessage({
    roomId: 'room-1', kind: 'text', from: alice.public.fingerprint,
    body: 'encrypted-payload', privateSigningKey: alice.signing,
    senderPublicJwk: alice.public.signing,
  });
  assert.equal(await verifyMessage(msg, alice.public.signing), true);
  assert.equal(await verifyMessage({ ...msg, body: 'tampered' }, alice.public.signing), false);
  assert.equal(await verifyMessage({ ...msg, from: 'someone-else' }, alice.public.signing), false);
  assert.equal(await verifyMessage({ ...msg, signature: '' }, alice.public.signing), false);
});

test('expiry is enforced and serialisation is stable', async () => {
  const alice = await generateIdentity('Alice');
  const msg = await createMessage({
    roomId: 'room-1', kind: 'text', from: alice.public.fingerprint,
    body: 'payload', ttlMs: 1000, privateSigningKey: alice.signing,
    senderPublicJwk: alice.public.signing,
  });
  assert.equal(isExpired(msg, msg.createdAt + 10), false);
  assert.equal(isExpired(msg, msg.expiresAt + 1), true);
  assert.deepEqual(deserializeMessage(serializeMessage(msg)), JSON.parse(JSON.stringify(msg)));
});

test('signed ACK binds recipient, message id and route', async () => {
  const alice = await generateIdentity('Alice');
  const bob = await generateIdentity('Bob');
  const msg = await createMessage({
    roomId: 'room-1', kind: 'text', from: alice.public.fingerprint,
    body: 'payload', privateSigningKey: alice.signing,
    senderPublicJwk: alice.public.signing,
  });
  const ack = await createAck(msg, bob.public.fingerprint, 'community-mesh', bob.signing);
  assert.equal(await verifyAck(ack, bob.public.signing, msg.id), true);
  assert.equal(await verifyAck(ack, bob.public.signing, 'other-message'), false);
  assert.equal(await verifyAck({ ...ack, payload: { ...ack.payload, route: 'satellite-gateway' } }, bob.public.signing, msg.id), false);

  const updated = addAck(msg, ack);
  assert.equal(updated.acknowledgements.length, 1);
  assert.equal(addAck(updated, ack).acknowledgements.length, 1, 'duplicate ACKs are ignored');
});
