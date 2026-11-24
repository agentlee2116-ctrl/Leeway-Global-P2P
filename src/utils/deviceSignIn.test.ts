/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.DEVICE_SIGN_IN_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Positive and adversarial local device-key sign-in qualification
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/deviceSignIn.test.ts
WHY: A copied membership grant alone must not unlock a different device key
HOW: WebCrypto test fixture with valid, mismatched, and substituted signing identities
LICENSE: Existing repository terms
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeviceKeyRecord, SignedMembershipGrant } from './enrollmentCrypto';
import { verifyLocalDevicePossession } from './deviceSignIn';

test('valid member-bound ECDSA device can complete local sign-in', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const record = { deviceId: 'member-1', fingerprint: 'fp-1', signKeyPair: kp } as DeviceKeyRecord;
  const grant = { memberDeviceId: 'member-1', memberFingerprint: 'fp-1', memberSignPubJwk: pub } as SignedMembershipGrant;
  await assert.doesNotReject(verifyLocalDevicePossession(record, grant));
});

test('copied grant fails with a different private key', async () => {
  const kp1 = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  const kp2 = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  const pub1 = await crypto.subtle.exportKey('jwk', kp1.publicKey);
  const record = { deviceId: 'member-1', fingerprint: 'fp-1', signKeyPair: kp2 } as DeviceKeyRecord;
  const grant = { memberDeviceId: 'member-1', memberFingerprint: 'fp-1', memberSignPubJwk: pub1 } as SignedMembershipGrant;
  await assert.rejects(verifyLocalDevicePossession(record, grant), /verification failed/i);
});

test('device and fingerprint mismatches fail before cryptographic access', async () => {
  const grant = { memberDeviceId: 'member-1', memberFingerprint: 'fp-1' } as SignedMembershipGrant;
  const record = { deviceId: 'member-2', fingerprint: 'fp-2' } as DeviceKeyRecord;
  await assert.rejects(verifyLocalDevicePossession(record, grant), /does not match/i);
});
