/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CRYPTO_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: tests\crypto.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/crypto.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, decryptFrom, encryptFor, generateIdentity, issueCapability,
  sha256, sign, verifyCapability, verifySigned,
} from '../src/core/crypto.ts';

test('canonical JSON is deterministic regardless of key order', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(canonicalJson({ x: [1, { z: 3, y: 2 }] }), '{"x":[1,{"y":2,"z":3}]}');
});

test('SHA-256 produces a stable 64-char hex digest', async () => {
  const a = await sha256('leeway');
  assert.equal(a.length, 64);
  assert.equal(a, await sha256('leeway'));
  assert.notEqual(a, await sha256('LeeWay'));
});

test('identity generation yields distinct fingerprints', async () => {
  const a = await generateIdentity('Alice');
  const b = await generateIdentity('Bob');
  assert.notEqual(a.public.fingerprint, b.public.fingerprint);
  assert.equal(a.public.fingerprint.length, 64);
});

test('ECDH + AES-GCM round trip and tamper rejection', async () => {
  const alice = await generateIdentity('Alice');
  const bob = await generateIdentity('Bob');
  const envelope = await encryptFor('secret mesh payload', bob.public.agreement, alice.public.fingerprint);
  assert.equal(await decryptFrom(envelope, bob.agreement, alice.public.fingerprint), 'secret mesh payload');

  const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + 'AAAA' };
  await assert.rejects(() => decryptFrom(tampered, bob.agreement, alice.public.fingerprint));

  const wrongSender = await generateIdentity('Mallory');
  await assert.rejects(() => decryptFrom(envelope, bob.agreement, wrongSender.public.fingerprint));
});

test('Ed25519 signature verifies only for the right key and payload', async () => {
  const alice = await generateIdentity('Alice');
  const bob = await generateIdentity('Bob');
  const signed = await sign({ hello: 'mesh' }, alice.signing, alice.public.fingerprint);
  assert.equal(await verifySigned(signed, alice.public.signing, alice.public.fingerprint), true);
  assert.equal(await verifySigned(signed, bob.public.signing, alice.public.fingerprint), false);
  assert.equal(await verifySigned(signed, alice.public.signing, bob.public.fingerprint), false);
  assert.equal(await verifySigned({ ...signed, payload: { hello: 'evil' } }, alice.public.signing, alice.public.fingerprint), false);
});

test('capability token: valid, expired, wrong scope, missing right, forged', async () => {
  const authority = await generateIdentity('LeeWay Federate');
  const now = Date.now();
  const cap = await issueCapability(['room-1'], ['send', 'receive', 'ack'], authority.signing, authority.public.fingerprint, 60000);
  assert.equal((await verifyCapability(cap.token, authority.public.signing, 'room-1', 'send', now)).ok, true);

  const expired = await issueCapability(['room-1'], ['send'], authority.signing, authority.public.fingerprint, -1000);
  assert.match((await verifyCapability(expired.token, authority.public.signing, 'room-1', 'send', now)).reason!, /expired/);

  const wrongScope = await verifyCapability(cap.token, authority.public.signing, 'room-2', 'send', now);
  assert.equal(wrongScope.ok, false);
  assert.match(wrongScope.reason!, /does not cover/);

  const sendOnly = await issueCapability(['room-1'], ['send'], authority.signing, authority.public.fingerprint, 60000);
  const wrongRight = await verifyCapability(sendOnly.token, authority.public.signing, 'room-1', 'ack', now);
  assert.equal(wrongRight.ok, false);
  assert.match(wrongRight.reason!, /lacks/);

  const other = await generateIdentity('Rogue');
  const forged = await verifyCapability(cap.token, other.public.signing, 'room-1', 'send', now);
  assert.equal(forged.ok, false);
  assert.match(forged.reason!, /signature invalid/);

  assert.match((await verifyCapability('not-json', authority.public.signing, 'room-1', 'send', now)).reason!, /malformed/);
});
