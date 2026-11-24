/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TRANSPORT_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: tests\transport.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/transport.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, generateIdentity, sha256 } from '../src/core/crypto.ts';
import { createMessage, createAck, verifyMessage } from '../src/core/messages.ts';
import {
  AuthorityRegistry, MeshSatelliteTransport, declareGateway, networkCapabilities,
  qualifyGateway, routeFingerprint,
} from '../src/core/transport.ts';
import type { GatewayDeclaration, RouteKind, WireMessage } from '../src/core/types.ts';

interface Authority {
  id: string;
  publicJwk: JsonWebKey;
  privateKey: CryptoKey;
  fingerprint: string;
}

async function makeAuthority(id: string): Promise<Authority> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    id,
    publicJwk,
    privateKey: pair.privateKey,
    fingerprint: await sha256(canonicalJson(publicJwk)),
  };
}

function trust(registry: AuthorityRegistry, authority: Authority) {
  registry.add({
    id: authority.id, label: authority.id, publicJwk: authority.publicJwk,
    source: 'leeway-federate', trustedAt: Date.now(),
  });
}

async function gateway(authority: Authority, overrides: Record<string, unknown> = {}): Promise<GatewayDeclaration> {
  return declareGateway({
    id: (overrides.id as string) ?? 'gw-1',
    kind: (overrides.kind as RouteKind) ?? 'community-mesh',
    issuer: (overrides.issuer as string) ?? authority.id,
    scope: (overrides.scope as string[]) ?? ['room-1'],
    rights: (overrides.rights as Array<'send' | 'receive' | 'ack'>) ?? ['send', 'receive', 'ack'],
    verification: (overrides.verification as GatewayDeclaration['verification']) ?? 'verified',
    linkQuality: (overrides.linkQuality as number) ?? 0.8,
    endpoint: overrides.endpoint as string | undefined,
    note: overrides.note as string | undefined,
    issuerPrivateKey: (overrides.issuerPrivateKey as CryptoKey) ?? authority.privateKey,
    ttlMs: (overrides.ttlMs as number) ?? 60_000,
  });
}

test('a fully qualified LeeWay mesh gateway is accepted', async () => {
  const authority = await makeAuthority('leeway-federate');
  const registry = new AuthorityRegistry();
  trust(registry, authority);
  const g = await gateway(authority);
  const q = await qualifyGateway(g, registry, { roomId: 'room-1' }, 'send');
  assert.equal(q.qualified, true, q.reasons.join('; '));
  assert.equal(q.route, 'community-mesh');
});

test('REJECTION: untrusted / forged authority', async () => {
  const authority = await makeAuthority('leeway-federate');
  const rogue = await makeAuthority('rogue-gateway');
  const registry = new AuthorityRegistry();
  trust(registry, authority);

  const untrusted = await gateway(rogue, { issuer: rogue.id });
  const q1 = await qualifyGateway(untrusted, registry, { roomId: 'room-1' }, 'send');
  assert.equal(q1.qualified, false);
  assert.match(q1.reasons.join(' '), /not a trusted/);

  const forged = await gateway(authority, { issuerPrivateKey: rogue.privateKey, issuer: authority.id });
  const q2 = await qualifyGateway(forged, registry, { roomId: 'room-1' }, 'send');
  assert.equal(q2.qualified, false);
  assert.match(q2.reasons.join(' '), /signature invalid/);
});

test('REJECTION: expired capability token', async () => {
  const authority = await makeAuthority('leeway-device-bridge');
  const registry = new AuthorityRegistry();
  trust(registry, authority);
  const g = await gateway(authority, { ttlMs: -1000 });
  const q = await qualifyGateway(g, registry, { roomId: 'room-1' }, 'send');
  assert.equal(q.qualified, false);
  assert.match(q.reasons.join(' '), /expired/);
});

test('REJECTION: wrong room scope', async () => {
  const authority = await makeAuthority('leeway-federate');
  const registry = new AuthorityRegistry();
  trust(registry, authority);
  const g = await gateway(authority, { scope: ['another-room'] });
  const q = await qualifyGateway(g, registry, { roomId: 'room-1' }, 'send');
  assert.equal(q.qualified, false);
  assert.match(q.reasons.join(' '), /does not cover this room/);
});

test('REJECTION: receive-only gateway cannot carry acknowledged sends', async () => {
  const authority = await makeAuthority('leeway-federate');
  const registry = new AuthorityRegistry();
  trust(registry, authority);
  const g = await gateway(authority, { rights: ['send', 'receive'] });
  assert.equal(g.capabilities.bidirectional, false);
  const q = await qualifyGateway(g, registry, { roomId: 'room-1' }, 'send');
  assert.equal(q.qualified, false);
  assert.match(q.reasons.join(' '), /receive-only/);
});

test('REJECTION: unverified declaration and weak link', async () => {
  const authority = await makeAuthority('leeway-federate');
  const registry = new AuthorityRegistry();
  trust(registry, authority);
  const candidate = await qualifyGateway(await gateway(authority, { verification: 'candidate' }), registry, { roomId: 'room-1' }, 'send');
  assert.equal(candidate.qualified, false);
  assert.match(candidate.reasons.join(' '), /not 'verified'/);

  const weak = await qualifyGateway(await gateway(authority, { linkQuality: 0.1 }), registry, { roomId: 'room-1' }, 'send');
  assert.equal(weak.qualified, false);
  assert.match(weak.reasons.join(' '), /link quality/);
});

test('send retains message until a valid signed ACK arrives', async () => {
  const authority = await makeAuthority('leeway-federate');
  const alice = await generateIdentity('Alice');
  const bob = await generateIdentity('Bob');
  const sent: WireMessage[] = [];
  const transport = new MeshSatelliteTransport(async (m) => { sent.push(m); });
  trust(transport.authorities, authority);
  transport.addGateway(await gateway(authority));

  const message = await createMessage({
    roomId: 'room-1', kind: 'text', from: alice.public.fingerprint, to: bob.public.fingerprint,
    body: 'encrypted', privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing,
  });
  const result = await transport.send({
    message, roomId: 'room-1', privateSigningKey: alice.signing,
    selfFingerprint: alice.public.fingerprint,
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(sent.length, 1);
  assert.equal(transport.awaitingAcknowledgement().length, 1);

  const ack = await createAck(message, bob.public.fingerprint, 'community-mesh', bob.signing);
  const bad = await transport.acceptAck({
    ack: { ...ack, signature: 'AAAA' }, recipientPublicJwk: bob.public.signing,
    expectedRecipient: bob.public.fingerprint,
  });
  assert.equal(bad.ok, false);

  const accepted = await transport.acceptAck({
    ack, recipientPublicJwk: bob.public.signing, expectedRecipient: bob.public.fingerprint,
  });
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(accepted.message!.acknowledgements.length, 1);
});

test('receive accepts signed in-room messages only from qualified routes', async () => {
  const authority = await makeAuthority('leeway-federate');
  const alice = await generateIdentity('Alice');
  const transport = new MeshSatelliteTransport(async () => {});
  trust(transport.authorities, authority);
  transport.addGateway(await gateway(authority));

  const message = await createMessage({
    roomId: 'room-1', kind: 'text', from: alice.public.fingerprint,
    body: 'encrypted', privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing,
  });
  assert.equal((await transport.receive({ message, roomId: 'room-1', senderPublicJwk: alice.public.signing })).accepted, true);
  assert.equal((await transport.receive({ message, roomId: 'other', senderPublicJwk: alice.public.signing })).accepted, false);
  assert.equal((await transport.receive({ message: { ...message, signature: 'AAAA' }, roomId: 'room-1', senderPublicJwk: alice.public.signing })).accepted, false);
  assert.equal((await transport.receive({ message: { ...message, expiresAt: 1 }, roomId: 'room-1', senderPublicJwk: alice.public.signing })).accepted, false);
});

test('capability report never claims satellite transmission without a qualified satellite gateway', async () => {
  const authority = await makeAuthority('leeway-federate');
  const transport = new MeshSatelliteTransport(async () => {});
  trust(transport.authorities, authority);

  let report = await networkCapabilities(transport, 'room-1');
  assert.equal(report.satelliteTransmission, 'NOT VERIFIED');

  transport.addGateway(await gateway(authority));
  report = await networkCapabilities(transport, 'room-1');
  assert.equal(report.satelliteTransmission, 'NOT VERIFIED');

  transport.addGateway(await gateway(authority, { id: 'sat-1', kind: 'satellite-gateway', note: 'authorized terminal' }));
  report = await networkCapabilities(transport, 'room-1');
  assert.equal(report.satelliteTransmission, 'AVAILABLE');

  assert.equal(await routeFingerprint(transport.listGateways()[0]), await routeFingerprint(transport.listGateways()[0]));
});
