/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.ENROLLMENTCRYPTO_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\enrollmentCrypto.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/enrollmentCrypto.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MEMBER_PERMISSIONS,
  approveJoinRequest,
  containsPrivateKeyMaterial,
  createEncryptedRecoveryKit,
  createJoinRequest,
  createSignedInvitation,
  decryptCircleMessage,
  encryptCircleMessage,
  generateProtectedDeviceKeys,
  generateUnpredictableCircleId,
  issueOwnerSelfGrant,
  restoreFromRecoveryKit,
  revokeCircleDevice,
  verifyInvitation,
  verifyMembershipGrant,
  type CircleAuthorityState,
} from './enrollmentCrypto';

test('non-extractable device keys never leak private key material into invitations or grants', async () => {
  const ownerKeys = await generateProtectedDeviceKeys('dev-owner-1');
  assert.equal(ownerKeys.signKeyPair.privateKey.extractable, false);
  assert.equal(ownerKeys.ecdhKeyPair.privateKey.extractable, false);

  const circleId = generateUnpredictableCircleId();
  const invite = await createSignedInvitation({
    ownerKeys,
    ownerName: 'Leonard J. Lee',
    circleId,
    circleName: 'Lee Family',
    ttlMinutes: 15,
    defaultGrantPeriod: '6m',
    permissions: DEFAULT_MEMBER_PERMISSIONS,
  });

  assert.equal(containsPrivateKeyMaterial(invite), false);
  assert.ok(invite.issuerSignPubJwk.x);
  assert.ok(invite.issuerEcdhPubJwk.x);
});

test('full owner-approved enrollment enables fail-closed encrypted communication', async () => {
  const ownerKeys = await generateProtectedDeviceKeys('dev-owner-2');
  const memberKeys = await generateProtectedDeviceKeys('dev-member-2');
  const circleId = 'LW-LEE-99';

  const ownerGrant = await issueOwnerSelfGrant({
    ownerKeys,
    ownerName: 'Leonard',
    circleId,
    circleName: 'Lee Family',
  });

  let authority: CircleAuthorityState = {
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
        permissions: ownerGrant.permissions,
        grantId: ownerGrant.grantId,
        grantPeriod: '1y',
        issuedAt: ownerGrant.issuedAt,
        expiresAt: ownerGrant.expiresAt,
        revoked: false,
        signPubJwk: ownerKeys.signPubJwk,
        ecdhPubJwk: ownerKeys.ecdhPubJwk,
      },
    ],
    invitations: [],
    pendingRequests: [],
    usedInviteIds: [],
    revokedDeviceIds: [],
  };

  const invite = await createSignedInvitation({
    ownerKeys,
    ownerName: 'Leonard',
    circleId,
    circleName: 'Lee Family',
    ttlMinutes: 60,
    defaultGrantPeriod: '6m',
    permissions: DEFAULT_MEMBER_PERMISSIONS,
  });
  authority.invitations.push({ invite, status: 'active' });

  // Unapproved member cannot encrypt or decrypt
  await assert.rejects(() =>
    encryptCircleMessage({
      plaintext: 'Unauthorized probe',
      senderGrant: { ...ownerGrant, memberDeviceId: memberKeys.deviceId },
      authorityMembers: authority.members,
      revokedDeviceIds: authority.revokedDeviceIds,
    })
  );

  // Offline serialized invite + join request exchange
  const serializedInvite = JSON.stringify(invite);
  const parsedInvite = JSON.parse(serializedInvite);
  const inviteCheck = await verifyInvitation(parsedInvite, {
    usedInviteIds: authority.usedInviteIds,
  });
  assert.equal(inviteCheck.ok, true);

  const joinReq = await createJoinRequest({
    memberKeys,
    memberName: 'Maya',
    invite: parsedInvite,
  });
  const serializedReq = JSON.stringify(joinReq);
  const parsedReq = JSON.parse(serializedReq);

  const approved = await approveJoinRequest({
    ownerKeys,
    authority,
    request: parsedReq,
    grantPeriod: '6m',
  });
  authority = approved.nextAuthority;

  const memberGrantCheck = await verifyMembershipGrant(approved.grant, {
    expectedDeviceId: memberKeys.deviceId,
    revokedDeviceIds: authority.revokedDeviceIds,
  });
  assert.equal(memberGrantCheck.ok, true);

  // Encrypted message from Owner can be decrypted by approved Member
  const envelope = await encryptCircleMessage({
    plaintext: 'Welcome to the Lee Family secure line!',
    senderGrant: ownerGrant,
    authorityMembers: authority.members,
    revokedDeviceIds: authority.revokedDeviceIds,
  });
  const decrypted = await decryptCircleMessage({
    envelope,
    recipientGrant: approved.grant,
    revokedDeviceIds: authority.revokedDeviceIds,
  });
  assert.equal(decrypted, 'Welcome to the Lee Family secure line!');

  // Replaying the single-use invitation is rejected
  const replayCheck = await verifyInvitation(parsedInvite, {
    usedInviteIds: authority.usedInviteIds,
  });
  assert.equal(replayCheck.ok, false);
});

test('expired, forged, and revoked invites/grants/devices fail closed', async () => {
  const ownerKeys = await generateProtectedDeviceKeys('dev-owner-3');
  const attackerKeys = await generateProtectedDeviceKeys('dev-attacker-3');
  const memberKeys = await generateProtectedDeviceKeys('dev-member-3');

  const now = 1_700_000_000_000;
  const invite = await createSignedInvitation({
    ownerKeys,
    ownerName: 'Leonard',
    circleId: 'LW-CHK-01',
    circleName: 'Lee Family',
    ttlMinutes: 15,
    defaultGrantPeriod: '6m',
    permissions: DEFAULT_MEMBER_PERMISSIONS,
    now,
  });

  // Expired invite rejected
  const expiredCheck = await verifyInvitation(invite, { now: now + 16 * 60 * 1000 });
  assert.equal(expiredCheck.ok, false);

  // Forged invite rejected
  const forgedInvite = { ...invite, circleName: 'Fake Circle' };
  const forgedCheck = await verifyInvitation(forgedInvite, { now });
  assert.equal(forgedCheck.ok, false);

  // Forged grant signed by attacker rejected when checking expectedOwnerFingerprint
  const attackerGrant = await issueOwnerSelfGrant({
    ownerKeys: attackerKeys,
    ownerName: 'Attacker',
    circleId: 'LW-CHK-01',
    circleName: 'Lee Family',
    now,
  });
  const forgedGrantCheck = await verifyMembershipGrant(attackerGrant, {
    expectedOwnerFingerprint: ownerKeys.fingerprint,
    now,
  });
  assert.equal(forgedGrantCheck.ok, false);

  // Revoked member device cannot decrypt newly encrypted messages
  const ownerGrant = await issueOwnerSelfGrant({
    ownerKeys,
    ownerName: 'Leonard',
    circleId: 'LW-CHK-01',
    circleName: 'Lee Family',
    now,
  });

  let authority: CircleAuthorityState = {
    circleId: 'LW-CHK-01',
    circleName: 'Lee Family',
    ownerDeviceId: ownerKeys.deviceId,
    ownerName: 'Leonard',
    ownerFingerprint: ownerKeys.fingerprint,
    ownerSignPubJwk: ownerKeys.signPubJwk,
    ownerEcdhPubJwk: ownerKeys.ecdhPubJwk,
    defaultPermissions: DEFAULT_MEMBER_PERMISSIONS,
    defaultGrantPeriod: '1y',
    defaultInviteTtlMinutes: 60,
    members: [
      {
        deviceId: ownerKeys.deviceId,
        name: 'Leonard',
        fingerprint: ownerKeys.fingerprint,
        role: 'owner',
        permissions: ownerGrant.permissions,
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
    pendingRequests: [],
    usedInviteIds: [],
    revokedDeviceIds: [],
  };

  const joinReq = await createJoinRequest({
    memberKeys,
    memberName: 'Leo Jr.',
    invite,
    now,
  });
  const approved = await approveJoinRequest({
    ownerKeys,
    authority,
    request: joinReq,
    grantPeriod: '1y',
    now,
  });
  authority = revokeCircleDevice(approved.nextAuthority, memberKeys.deviceId);

  const postRevokeEnvelope = await encryptCircleMessage({
    plaintext: 'New secret after revocation',
    senderGrant: ownerGrant,
    authorityMembers: authority.members,
    revokedDeviceIds: authority.revokedDeviceIds,
    now,
  });

  assert.equal(
    postRevokeEnvelope.recipientDeviceIds.includes(memberKeys.deviceId),
    false
  );

  await assert.rejects(() =>
    decryptCircleMessage({
      envelope: postRevokeEnvelope,
      recipientGrant: approved.grant,
      revokedDeviceIds: authority.revokedDeviceIds,
      now,
    })
  );
});

test('encrypted recovery kit restores metadata with passphrase and requires renewed authorization', async () => {
  const ownerKeys = await generateProtectedDeviceKeys('dev-owner-rec');
  const kit = await createEncryptedRecoveryKit({
    passphrase: 'strong-family-phrase',
    circleId: 'LW-REC-01',
    circleName: 'Lee Family',
    ownerKeys,
    ownerName: 'Leonard J. Lee',
  });

  assert.equal(containsPrivateKeyMaterial(kit), false);
  assert.equal(kit.requiresRenewedAuthorizationOnRestore, true);

  await assert.rejects(() => restoreFromRecoveryKit(kit, 'wrong-passphrase'));

  const restored = await restoreFromRecoveryKit(kit, 'strong-family-phrase');
  assert.equal(restored.circleId, 'LW-REC-01');
  assert.equal(restored.previousFingerprint, ownerKeys.fingerprint);
  assert.equal(restored.requiresRenewedAuthorization, true);
});
