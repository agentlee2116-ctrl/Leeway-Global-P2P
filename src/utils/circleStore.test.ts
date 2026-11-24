/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CIRCLESTORE_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\circleStore.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/circleStore.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearEnrollmentSession,
  clearPendingMemberEnrollment,
  encodeBundleToken,
  encodeInviteShareUrl,
  evaluateEnrollmentGate,
  parseBundleInput,
  saveEnrollmentSession,
  saveKnownRevocations,
  savePendingMemberEnrollment,
} from './circleStore';
import {
  approveJoinRequest,
  createJoinRequest,
  createSignedInvitation,
  DEFAULT_MEMBER_PERMISSIONS,
  generateProtectedDeviceKeys,
  generateUnpredictableCircleId,
  issueOwnerSelfGrant,
  OWNER_PERMISSIONS,
  type CircleAuthorityState,
} from './enrollmentCrypto';

test('token encoding and URL parsing preserve signed invite and reject private keys', async () => {
  const ownerKeys = await generateProtectedDeviceKeys('owner-store-test');
  const invite = await createSignedInvitation({
    ownerKeys,
    ownerName: 'Leonard Lee',
    circleId: 'LW-ABC-99',
    circleName: 'Lee Family',
    ttlMinutes: 60,
    defaultGrantPeriod: '6m',
    permissions: DEFAULT_MEMBER_PERMISSIONS,
  });

  const shareUrl = encodeInviteShareUrl(invite);
  const parsedFromUrl = parseBundleInput<typeof invite>(shareUrl, 'LWINV1');
  assert.equal(parsedFromUrl.ok, true);
  if (parsedFromUrl.ok) {
    assert.equal(parsedFromUrl.data.inviteId, invite.inviteId);
    assert.equal(parsedFromUrl.data.circleName, 'Lee Family');
  }

  const wrongType = parseBundleInput(encodeBundleToken('LWREQ1', { hello: 'world' }), 'LWINV1');
  assert.equal(wrongType.ok, false);

  const leakedJson = JSON.stringify({ ...invite, d: 'FORBIDDEN_PRIVATE_D' });
  const rejectedSecret = parseBundleInput(leakedJson);
  assert.equal(rejectedSecret.ok, false);
});

test('startup enrollment gate fails closed when uninitialized, preserves pending member restart, and blocks revoked devices', async () => {
  await clearEnrollmentSession();
  await clearPendingMemberEnrollment();

  const initialGate = await evaluateEnrollmentGate();
  assert.equal(initialGate.status, 'locked');

  const ownerKeys = await generateProtectedDeviceKeys('owner-gate-1');
  const memberKeys = await generateProtectedDeviceKeys('member-gate-1');
  const circleId = generateUnpredictableCircleId();

  const invite = await createSignedInvitation({
    ownerKeys,
    ownerName: 'Leonard',
    circleId,
    circleName: 'Lee Family',
    ttlMinutes: 60,
    defaultGrantPeriod: '6m',
    permissions: DEFAULT_MEMBER_PERMISSIONS,
  });

  const joinReq = await createJoinRequest({
    memberKeys,
    memberName: 'Aunt Maya',
    invite,
  });

  await savePendingMemberEnrollment({
    version: 1,
    invite,
    memberDeviceId: memberKeys.deviceId,
    memberName: 'Aunt Maya',
    deviceLockEnabled: true,
    joinRequest: joinReq,
    safetyCode: joinReq.safetyCode,
    createdAt: Date.now(),
  });

  const pendingGate = await evaluateEnrollmentGate();
  assert.equal(pendingGate.status, 'pending');
  if (pendingGate.status === 'pending') {
    assert.equal(pendingGate.pending.memberName, 'Aunt Maya');
    assert.equal(pendingGate.pending.safetyCode, joinReq.safetyCode);
  }

  const ownerGrant = await issueOwnerSelfGrant({
    ownerKeys,
    ownerName: 'Leonard',
    circleId,
    circleName: 'Lee Family',
  });

  const authority: CircleAuthorityState = {
    circleId,
    circleName: 'Lee Family',
    ownerDeviceId: ownerKeys.deviceId,
    ownerName: 'Leonard',
    ownerFingerprint: ownerKeys.fingerprint,
    ownerSignPubJwk: ownerKeys.signPubJwk,
    ownerEcdhPubJwk: ownerKeys.ecdhPubJwk,
    defaultPermissions: DEFAULT_MEMBER_PERMISSIONS,
    defaultGrantPeriod: '6m',
    defaultInviteTtlMinutes: 60,
    members: [
      {
        deviceId: ownerKeys.deviceId,
        name: 'Leonard',
        fingerprint: ownerKeys.fingerprint,
        role: 'owner',
        permissions: OWNER_PERMISSIONS,
        grantId: ownerGrant.grantId,
        grantPeriod: '1y',
        issuedAt: ownerGrant.issuedAt,
        expiresAt: ownerGrant.expiresAt,
        revoked: false,
        signPubJwk: ownerKeys.signPubJwk,
        ecdhPubJwk: ownerKeys.ecdhPubJwk,
      },
    ],
    invitations: [{ invite, status: 'active' }],
    pendingRequests: [joinReq],
    usedInviteIds: [],
    revokedDeviceIds: [],
  };

  const approved = await approveJoinRequest({
    ownerKeys,
    authority,
    request: joinReq,
    grantPeriod: '6m',
  });

  await clearPendingMemberEnrollment();
  await saveEnrollmentSession({
    version: 1,
    deviceId: memberKeys.deviceId,
    role: 'member',
    userName: 'Aunt Maya',
    circleId,
    circleName: 'Lee Family',
    deviceLockEnabled: true,
    grant: approved.grant,
    enrolledAt: Date.now(),
  });

  const enrolledGate = await evaluateEnrollmentGate();
  assert.equal(enrolledGate.status, 'enrolled');

  // Revocation must lock out the device immediately
  await saveKnownRevocations(circleId, [memberKeys.deviceId]);
  const revokedGate = await evaluateEnrollmentGate();
  assert.equal(revokedGate.status, 'locked');
});
