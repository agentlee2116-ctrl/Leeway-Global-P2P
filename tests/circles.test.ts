/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TESTS_CIRCLES
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Private circle and revocable time-bound service grant tests
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/circles.test.ts
WHY: Expired or revoked service access must be rejected cleanly on every route
HOW: Real Ed25519 signatures, Expired/revoked/wrong-circle negative cases, pure PWA update decision tests
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../src/core/crypto.ts';
import {
  circleIdFromName, issueServiceGrant, ONE_YEAR_MS, RevocationList,
  SIX_MONTHS_MS, validateCircleAccess,
} from '../src/core/circles.ts';
import { isUpdateActionable } from '../src/pwa-updates.ts';

async function fixture() {
  const authority = await generateIdentity('Circle Authority');
  const member = await generateIdentity('Family member');
  const circleId = circleIdFromName('Lee Family');
  const circle = {
    circleId, name: 'Lee Family', createdAt: Date.now(),
    members: [member.public.fingerprint], issuer: authority.public.fingerprint,
  };
  const grant = await issueServiceGrant({
    circleId, scope: 'relay', rights: ['join', 'send', 'receive', 'ack'],
    fingerprint: member.public.fingerprint, issuerPrivateKey: authority.signing,
    issuerFingerprint: authority.public.fingerprint,
  });
  return { authority, member, circle, grant };
}

test('valid circle grant is accepted with six-month and one-year windows', async () => {
  const { authority, circle, grant } = await fixture();
  const check = await validateCircleAccess({
    circle, grant, issuerPublicJwk: authority.public.signing,
    requiredRight: 'join', requiredScope: 'relay',
  });
  assert.equal(check.ok, true, check.reason);
  assert.equal(check.status, 'active');

  const year = await issueServiceGrant({
    circleId: circle.circleId, scope: 'service', rights: ['join'],
    fingerprint: circle.members[0], issuerPrivateKey: authority.signing,
    issuerFingerprint: authority.public.fingerprint, windowMs: ONE_YEAR_MS,
  });
  assert.ok(Math.abs((year.payload.expiresAt - year.payload.issuedAt) - ONE_YEAR_MS) < 5);
  const six = await issueServiceGrant({
    circleId: circle.circleId, scope: 'relay', rights: ['join'],
    fingerprint: circle.members[0], issuerPrivateKey: authority.signing,
    issuerFingerprint: authority.public.fingerprint, windowMs: SIX_MONTHS_MS,
  });
  assert.ok(Math.abs((six.payload.expiresAt - six.payload.issuedAt) - SIX_MONTHS_MS) < 5);
});

test('REJECTION: expired grant and expired circle window', async () => {
  const { authority, circle } = await fixture();
  const expired = await issueServiceGrant({
    circleId: circle.circleId, scope: 'relay', rights: ['join'],
    fingerprint: circle.members[0], issuerPrivateKey: authority.signing,
    issuerFingerprint: authority.public.fingerprint, windowMs: -1000,
  });
  const a = await validateCircleAccess({
    circle, grant: expired, issuerPublicJwk: authority.public.signing,
    requiredRight: 'join', requiredScope: 'relay',
  });
  assert.equal(a.ok, false);
  assert.equal(a.status, 'expired');
  assert.match(a.reason!, /expired/);

  const valid = await issueServiceGrant({
    circleId: circle.circleId, scope: 'relay', rights: ['join'],
    fingerprint: circle.members[0], issuerPrivateKey: authority.signing,
    issuerFingerprint: authority.public.fingerprint,
  });
  const b = await validateCircleAccess({
    circle: { ...circle, expiresAt: Date.now() - 1 }, grant: valid,
    issuerPublicJwk: authority.public.signing, requiredRight: 'join',
  });
  assert.equal(b.ok, false);
  assert.match(b.reason!, /circle service window expired/);
});

test('REJECTION: revoked grant, wrong circle, wrong authority, missing right', async () => {
  const { authority, circle, grant } = await fixture();
  const revocations = new RevocationList();
  revocations.revoke(grant.payload.grantId);
  const a = await validateCircleAccess({
    circle, grant, issuerPublicJwk: authority.public.signing,
    requiredRight: 'join', revocations,
  });
  assert.equal(a.ok, false);
  assert.equal(a.status, 'revoked');
  assert.match(a.reason!, /revoked/);
  revocations.restore(grant.payload.grantId);
  assert.equal(revocations.isRevoked(grant.payload.grantId), false);

  const b = await validateCircleAccess({
    circle: { ...circle, circleId: 'another-circle' }, grant,
    issuerPublicJwk: authority.public.signing, requiredRight: 'join',
  });
  assert.equal(b.ok, false);
  assert.match(b.reason!, /different circle/);

  const rogue = await generateIdentity('Rogue authority');
  const c = await validateCircleAccess({ circle, grant, issuerPublicJwk: rogue.public.signing, requiredRight: 'join' });
  assert.equal(c.ok, false);
  assert.match(c.reason!, /signature invalid/);

  const noSend = await issueServiceGrant({
    circleId: circle.circleId, scope: 'relay', rights: ['join'],
    fingerprint: circle.members[0], issuerPrivateKey: authority.signing,
    issuerFingerprint: authority.public.fingerprint,
  });
  const e = await validateCircleAccess({ circle, grant: noSend, issuerPublicJwk: authority.public.signing, requiredRight: 'send' });
  assert.equal(e.ok, false);
  assert.match(e.reason!, /lacks 'send'/);
});

test('PWA update prompt is actionable only when online and available', () => {
  assert.equal(isUpdateActionable('available', true), true);
  assert.equal(isUpdateActionable('available', false), false);
  assert.equal(isUpdateActionable('checking', true), false);
  assert.equal(isUpdateActionable('unavailable', true), false);
  assert.equal(isUpdateActionable('active', true), false);
});
