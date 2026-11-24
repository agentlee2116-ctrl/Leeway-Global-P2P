/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.DEVICE_SIGN_IN
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Local proof that the saved device still controls the key named by its signed membership grant
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/deviceSignIn.ts
WHY: Prevent a decorative sign-in control from bypassing authorized enrollment checks
HOW: Sign and verify a fresh random challenge using the bound non-extractable device key
LICENSE: Existing repository terms
*/
import type { DeviceKeyRecord, SignedMembershipGrant } from './enrollmentCrypto';

/** This is local device-key revalidation, NOT password/passkey account authentication. */
export async function verifyLocalDevicePossession(
  keys: DeviceKeyRecord,
  grant: SignedMembershipGrant,
): Promise<void> {
  if (keys.deviceId !== grant.memberDeviceId || keys.fingerprint !== grant.memberFingerprint) {
    throw new Error('Enrolled device does not match the signed membership grant.');
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('Secure device key verification is unavailable.');
  const challenge = cryptoApi.getRandomValues(new Uint8Array(32));
  const signature = await cryptoApi.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keys.signKeyPair.privateKey,
    challenge,
  );
  const authorizedPublicKey = await cryptoApi.subtle.importKey(
    'jwk',
    grant.memberSignPubJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const valid = await cryptoApi.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    authorizedPublicKey,
    signature,
    challenge,
  );
  if (!valid) throw new Error('Device cryptographic identity verification failed.');
}
