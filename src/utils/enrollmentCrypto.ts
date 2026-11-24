/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.ENROLLMENTCRYPTO
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\enrollmentCrypto.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/enrollmentCrypto.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
// Canonical Enrollment, Membership & Web Crypto Security System for LeeWay Global P2P
// Uses non-extractable ECDSA P-256 + ECDH P-256 device keys stored in IndexedDB (never plaintext JWKs in localStorage).
// Message confidentiality reuses the canonical ECDH/HKDF/AES-GCM contracts in src/core/crypto.ts.
import { decryptFrom, encryptFor } from '../core/crypto.ts';

export type GrantPeriod = '6m' | '1y';
export type InviteTtlMinutes = 15 | 60 | 1440;

export interface CirclePermissions {
  sendMessage: boolean;
  pushToTalk: boolean;
  videoRoom: boolean;
  inviteOthers: boolean;
  manageDevices: boolean;
}

export const DEFAULT_MEMBER_PERMISSIONS: CirclePermissions = {
  sendMessage: true,
  pushToTalk: true,
  videoRoom: true,
  inviteOthers: false,
  manageDevices: false,
};

export const OWNER_PERMISSIONS: CirclePermissions = {
  sendMessage: true,
  pushToTalk: true,
  videoRoom: true,
  inviteOthers: true,
  manageDevices: true,
};

export interface DeviceKeyRecord {
  deviceId: string;
  fingerprint: string;
  signKeyPair: CryptoKeyPair;
  ecdhKeyPair: CryptoKeyPair;
  signPubJwk: JsonWebKey;
  ecdhPubJwk: JsonWebKey;
  createdAt: number;
}

export interface SignedInvitation {
  version: 1;
  inviteId: string;
  circleId: string;
  circleName: string;
  issuerName: string;
  issuerDeviceId: string;
  issuerFingerprint: string;
  issuerSignPubJwk: JsonWebKey;
  issuerEcdhPubJwk: JsonWebKey;
  issuedAt: number;
  expiresAt: number;
  singleUse: true;
  defaultGrantPeriod: GrantPeriod;
  permissions: CirclePermissions;
  signature: string;
}

export interface JoinRequestBundle {
  version: 1;
  requestId: string;
  inviteId: string;
  circleId: string;
  circleName: string;
  memberName: string;
  memberDeviceId: string;
  memberFingerprint: string;
  memberSignPubJwk: JsonWebKey;
  memberEcdhPubJwk: JsonWebKey;
  safetyCode: string;
  requestedAt: number;
  signature: string;
}

export interface SignedMembershipGrant {
  version: 1;
  grantId: string;
  circleId: string;
  circleName: string;
  memberName: string;
  memberDeviceId: string;
  memberFingerprint: string;
  memberSignPubJwk: JsonWebKey;
  memberEcdhPubJwk: JsonWebKey;
  role: 'owner' | 'member';
  permissions: CirclePermissions;
  grantPeriod: GrantPeriod;
  issuedAt: number;
  expiresAt: number;
  ownerDeviceId: string;
  ownerFingerprint: string;
  ownerSignPubJwk: JsonWebKey;
  ownerEcdhPubJwk: JsonWebKey;
  signature: string;
}

export interface EncryptedRecoveryKit {
  version: 1;
  circleId: string;
  circleName: string;
  ownerName: string;
  ownerDeviceId: string;
  ownerFingerprint: string;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: number;
  requiresRenewedAuthorizationOnRestore: true;
}

export interface CircleMemberRecord {
  deviceId: string;
  name: string;
  fingerprint: string;
  role: 'owner' | 'member';
  permissions: CirclePermissions;
  grantId: string;
  grantPeriod: GrantPeriod;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  signPubJwk: JsonWebKey;
  ecdhPubJwk: JsonWebKey;
}

export interface CircleAuthorityState {
  circleId: string;
  circleName: string;
  ownerDeviceId: string;
  ownerName: string;
  ownerFingerprint: string;
  ownerSignPubJwk: JsonWebKey;
  ownerEcdhPubJwk: JsonWebKey;
  defaultPermissions: CirclePermissions;
  defaultGrantPeriod: GrantPeriod;
  defaultInviteTtlMinutes: InviteTtlMinutes;
  members: CircleMemberRecord[];
  invitations: Array<{
    invite: SignedInvitation;
    status: 'active' | 'used' | 'expired' | 'revoked';
  }>;
  pendingRequests: JoinRequestBundle[];
  usedInviteIds: string[];
  revokedDeviceIds: string[];
}

export interface EncryptedEnvelope {
  version: 1;
  circleId: string;
  senderDeviceId: string;
  senderFingerprint?: string;
  /** Per-recipient ECDH/HKDF/AES-GCM copies produced by src/core/crypto.ts. */
  recipientEnvelopes?: Array<{
    deviceId: string;
    envelope: {
      v: 1;
      alg: string;
      ephemeral: JsonWebKey;
      iv: string;
      ciphertext: string;
    };
  }>;
  /** Legacy fields are retained only so older stored envelopes remain readable. */
  iv: string;
  ciphertext: string;
  recipientDeviceIds: string[];
  createdAt: number;
}

const memoryKeyStore = new Map<string, DeviceKeyRecord>();

function getWebCrypto(): Crypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is required for LeeWay Global P2P.');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(',')}}`;
}

export async function computePublicFingerprint(
  signPubJwk: JsonWebKey,
  ecdhPubJwk: JsonWebKey
): Promise<string> {
  const cryptoApi = getWebCrypto();
  const data = new TextEncoder().encode(canonicalStringify({ signPubJwk, ecdhPubJwk }));
  const digest = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', data));
  const hex = Array.from(digest.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export async function computeSafetyCode(
  ownerFingerprint: string,
  memberFingerprint: string
): Promise<string> {
  const cryptoApi = getWebCrypto();
  const ordered = [ownerFingerprint, memberFingerprint].sort().join(':');
  const digest = new Uint8Array(
    await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(ordered))
  );
  const num = ((digest[0] << 16) | (digest[1] << 8) | digest[2]) % 1000000;
  const padded = String(num).padStart(6, '0');
  return `${padded.slice(0, 3)}-${padded.slice(3, 6)}`;
}

export function generateUnpredictableCircleId(): string {
  const cryptoApi = getWebCrypto();
  const bytes = new Uint8Array(5);
  cryptoApi.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `LW-${code.slice(0, 3)}-${code.slice(3, 5)}`;
}

const IDB_NAME = 'leeway-secure-keystore';
const IDB_STORE = 'device_keys';

async function openKeyDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'deviceId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDeviceKeysProtected(record: DeviceKeyRecord): Promise<void> {
  memoryKeyStore.set(record.deviceId, record);
  const db = await openKeyDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadDeviceKeysProtected(
  deviceId: string
): Promise<DeviceKeyRecord | null> {
  const mem = memoryKeyStore.get(deviceId);
  if (mem) return mem;
  const db = await openKeyDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(deviceId);
      req.onsuccess = () => {
        const found = (req.result as DeviceKeyRecord | undefined) ?? null;
        if (found) memoryKeyStore.set(deviceId, found);
        resolve(found);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearProtectedDeviceKeys(): Promise<void> {
  memoryKeyStore.clear();
  const db = await openKeyDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Generate non-extractable ECDSA + ECDH device keys (cannot be exported to plaintext JWK/localStorage)
export async function generateProtectedDeviceKeys(
  deviceId?: string
): Promise<DeviceKeyRecord> {
  const cryptoApi = getWebCrypto();
  const idBytes = new Uint8Array(6);
  cryptoApi.getRandomValues(idBytes);
  const resolvedId =
    deviceId ??
    `dev-${Array.from(idBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

  const signKeyPair = await cryptoApi.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  );

  const ecdhKeyPair = await cryptoApi.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const signPubJwk = await cryptoApi.subtle.exportKey('jwk', signKeyPair.publicKey);
  const ecdhPubJwk = await cryptoApi.subtle.exportKey('jwk', ecdhKeyPair.publicKey);
  const fingerprint = await computePublicFingerprint(signPubJwk, ecdhPubJwk);

  const record: DeviceKeyRecord = {
    deviceId: resolvedId,
    fingerprint,
    signKeyPair,
    ecdhKeyPair,
    signPubJwk,
    ecdhPubJwk,
    createdAt: Date.now(),
  };

  await saveDeviceKeysProtected(record);
  return record;
}

async function signPayload(privateKey: CryptoKey, payload: unknown): Promise<string> {
  const cryptoApi = getWebCrypto();
  const encoded = new TextEncoder().encode(canonicalStringify(payload));
  const sig = await cryptoApi.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded
  );
  return bytesToBase64(new Uint8Array(sig));
}

async function verifySignature(
  pubJwk: JsonWebKey,
  payload: unknown,
  signatureB64: string
): Promise<boolean> {
  try {
    const cryptoApi = getWebCrypto();
    if (typeof pubJwk.d === 'string') return false; // Public JWK must never hold private material
    const pubKey = await cryptoApi.subtle.importKey(
      'jwk',
      pubJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const encoded = new TextEncoder().encode(canonicalStringify(payload));
    const sigBytes = base64ToBytes(signatureB64);
    return await cryptoApi.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      toArrayBuffer(sigBytes),
      encoded
    );
  } catch {
    return false;
  }
}

export function getGrantExpiryTimestamp(issuedAt: number, period: GrantPeriod): number {
  const days = period === '1y' ? 365 : 182;
  return issuedAt + days * 24 * 60 * 60 * 1000;
}

export async function createSignedInvitation(params: {
  ownerKeys: DeviceKeyRecord;
  ownerName: string;
  circleId: string;
  circleName: string;
  ttlMinutes: InviteTtlMinutes;
  defaultGrantPeriod: GrantPeriod;
  permissions: CirclePermissions;
  now?: number;
}): Promise<SignedInvitation> {
  const cryptoApi = getWebCrypto();
  const rand = new Uint8Array(8);
  cryptoApi.getRandomValues(rand);
  const inviteId = `inv-${Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
  const issuedAt = params.now ?? Date.now();
  const expiresAt = issuedAt + params.ttlMinutes * 60 * 1000;

  const unsigned = {
    version: 1 as const,
    inviteId,
    circleId: params.circleId,
    circleName: params.circleName,
    issuerName: params.ownerName,
    issuerDeviceId: params.ownerKeys.deviceId,
    issuerFingerprint: params.ownerKeys.fingerprint,
    issuerSignPubJwk: params.ownerKeys.signPubJwk,
    issuerEcdhPubJwk: params.ownerKeys.ecdhPubJwk,
    issuedAt,
    expiresAt,
    singleUse: true as const,
    defaultGrantPeriod: params.defaultGrantPeriod,
    permissions: params.permissions,
  };

  const signature = await signPayload(params.ownerKeys.signKeyPair.privateKey, unsigned);
  return { ...unsigned, signature };
}

export function containsPrivateKeyMaterial(obj: unknown): boolean {
  const serialized = JSON.stringify(obj);
  return (
    /"d"\s*:/.test(serialized) ||
    /"privateKey"\s*:/.test(serialized) ||
    /"k"\s*:/.test(serialized)
  );
}

export async function verifyInvitation(
  invite: SignedInvitation,
  options?: { usedInviteIds?: string[]; revokedDeviceIds?: string[]; now?: number }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!invite || invite.version !== 1 || !invite.inviteId || !invite.circleId) {
    return { ok: false, reason: 'Malformed invitation bundle.' };
  }
  if (containsPrivateKeyMaterial(invite)) {
    return { ok: false, reason: 'Invitation rejected: unexpected private key material.' };
  }
  const now = options?.now ?? Date.now();
  if (now > invite.expiresAt) {
    return { ok: false, reason: 'Invitation has expired. Ask your organizer for a fresh invite.' };
  }
  if (options?.usedInviteIds?.includes(invite.inviteId)) {
    return { ok: false, reason: 'This single-use invitation has already been used.' };
  }
  if (options?.revokedDeviceIds?.includes(invite.issuerDeviceId)) {
    return { ok: false, reason: 'Issuing device has been revoked.' };
  }
  const expectedFp = await computePublicFingerprint(
    invite.issuerSignPubJwk,
    invite.issuerEcdhPubJwk
  );
  if (expectedFp !== invite.issuerFingerprint) {
    return { ok: false, reason: 'Invitation issuer fingerprint mismatch.' };
  }
  const { signature, ...unsigned } = invite;
  const validSig = await verifySignature(invite.issuerSignPubJwk, unsigned, signature);
  if (!validSig) {
    return { ok: false, reason: 'Invalid or forged invitation signature.' };
  }
  return { ok: true };
}

export async function createJoinRequest(params: {
  memberKeys: DeviceKeyRecord;
  memberName: string;
  invite: SignedInvitation;
  now?: number;
}): Promise<JoinRequestBundle> {
  const cryptoApi = getWebCrypto();
  const rand = new Uint8Array(6);
  cryptoApi.getRandomValues(rand);
  const requestId = `req-${Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
  const safetyCode = await computeSafetyCode(
    params.invite.issuerFingerprint,
    params.memberKeys.fingerprint
  );
  const requestedAt = params.now ?? Date.now();

  const unsigned = {
    version: 1 as const,
    requestId,
    inviteId: params.invite.inviteId,
    circleId: params.invite.circleId,
    circleName: params.invite.circleName,
    memberName: params.memberName.trim(),
    memberDeviceId: params.memberKeys.deviceId,
    memberFingerprint: params.memberKeys.fingerprint,
    memberSignPubJwk: params.memberKeys.signPubJwk,
    memberEcdhPubJwk: params.memberKeys.ecdhPubJwk,
    safetyCode,
    requestedAt,
  };

  const signature = await signPayload(params.memberKeys.signKeyPair.privateKey, unsigned);
  return { ...unsigned, signature };
}

export async function verifyJoinRequest(
  request: JoinRequestBundle,
  authority: CircleAuthorityState,
  now?: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!request || request.circleId !== authority.circleId) {
    return { ok: false, reason: 'Join request is bound to a different circle.' };
  }
  if (authority.revokedDeviceIds.includes(request.memberDeviceId)) {
    return { ok: false, reason: 'Joining device is on the circle revocation list.' };
  }
  const matchingInv = authority.invitations.find(
    (entry) => entry.invite.inviteId === request.inviteId
  );
  if (!matchingInv) {
    return { ok: false, reason: 'Invitation ID not recognized by this circle.' };
  }
  if (matchingInv.status !== 'active') {
    return { ok: false, reason: `Invitation status is ${matchingInv.status}.` };
  }
  const inviteCheck = await verifyInvitation(matchingInv.invite, {
    usedInviteIds: authority.usedInviteIds,
    revokedDeviceIds: authority.revokedDeviceIds,
    now,
  });
  if (!inviteCheck.ok) return inviteCheck;

  const expectedFp = await computePublicFingerprint(
    request.memberSignPubJwk,
    request.memberEcdhPubJwk
  );
  if (expectedFp !== request.memberFingerprint) {
    return { ok: false, reason: 'Joining device fingerprint mismatch.' };
  }
  const { signature, ...unsigned } = request;
  const sigOk = await verifySignature(request.memberSignPubJwk, unsigned, signature);
  if (!sigOk) {
    return { ok: false, reason: 'Invalid join request signature.' };
  }
  return { ok: true };
}

export async function issueOwnerSelfGrant(params: {
  ownerKeys: DeviceKeyRecord;
  ownerName: string;
  circleId: string;
  circleName: string;
  now?: number;
}): Promise<SignedMembershipGrant> {
  const cryptoApi = getWebCrypto();
  const rand = new Uint8Array(6);
  cryptoApi.getRandomValues(rand);
  const grantId = `grt-${Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
  const issuedAt = params.now ?? Date.now();
  const expiresAt = getGrantExpiryTimestamp(issuedAt, '1y');

  const unsigned = {
    version: 1 as const,
    grantId,
    circleId: params.circleId,
    circleName: params.circleName,
    memberName: params.ownerName,
    memberDeviceId: params.ownerKeys.deviceId,
    memberFingerprint: params.ownerKeys.fingerprint,
    memberSignPubJwk: params.ownerKeys.signPubJwk,
    memberEcdhPubJwk: params.ownerKeys.ecdhPubJwk,
    role: 'owner' as const,
    permissions: OWNER_PERMISSIONS,
    grantPeriod: '1y' as const,
    issuedAt,
    expiresAt,
    ownerDeviceId: params.ownerKeys.deviceId,
    ownerFingerprint: params.ownerKeys.fingerprint,
    ownerSignPubJwk: params.ownerKeys.signPubJwk,
    ownerEcdhPubJwk: params.ownerKeys.ecdhPubJwk,
  };

  const signature = await signPayload(params.ownerKeys.signKeyPair.privateKey, unsigned);
  return { ...unsigned, signature };
}

export async function approveJoinRequest(params: {
  ownerKeys: DeviceKeyRecord;
  authority: CircleAuthorityState;
  request: JoinRequestBundle;
  grantPeriod: GrantPeriod;
  permissions?: CirclePermissions;
  now?: number;
}): Promise<{ grant: SignedMembershipGrant; nextAuthority: CircleAuthorityState }> {
  const check = await verifyJoinRequest(params.request, params.authority, params.now);
  if (!check.ok) {
    throw new Error(check.reason);
  }
  const cryptoApi = getWebCrypto();
  const rand = new Uint8Array(6);
  cryptoApi.getRandomValues(rand);
  const grantId = `grt-${Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
  const issuedAt = params.now ?? Date.now();
  const expiresAt = getGrantExpiryTimestamp(issuedAt, params.grantPeriod);
  const resolvedPermissions = params.permissions ?? params.authority.defaultPermissions;

  const unsigned = {
    version: 1 as const,
    grantId,
    circleId: params.authority.circleId,
    circleName: params.authority.circleName,
    memberName: params.request.memberName,
    memberDeviceId: params.request.memberDeviceId,
    memberFingerprint: params.request.memberFingerprint,
    memberSignPubJwk: params.request.memberSignPubJwk,
    memberEcdhPubJwk: params.request.memberEcdhPubJwk,
    role: 'member' as const,
    permissions: resolvedPermissions,
    grantPeriod: params.grantPeriod,
    issuedAt,
    expiresAt,
    ownerDeviceId: params.ownerKeys.deviceId,
    ownerFingerprint: params.ownerKeys.fingerprint,
    ownerSignPubJwk: params.ownerKeys.signPubJwk,
    ownerEcdhPubJwk: params.ownerKeys.ecdhPubJwk,
  };

  const signature = await signPayload(params.ownerKeys.signKeyPair.privateKey, unsigned);
  const grant: SignedMembershipGrant = { ...unsigned, signature };

  const nextMember: CircleMemberRecord = {
    deviceId: params.request.memberDeviceId,
    name: params.request.memberName,
    fingerprint: params.request.memberFingerprint,
    role: 'member',
    permissions: resolvedPermissions,
    grantId,
    grantPeriod: params.grantPeriod,
    issuedAt,
    expiresAt,
    revoked: false,
    signPubJwk: params.request.memberSignPubJwk,
    ecdhPubJwk: params.request.memberEcdhPubJwk,
  };

  const nextAuthority: CircleAuthorityState = {
    ...params.authority,
    members: [
      ...params.authority.members.filter((m) => m.deviceId !== nextMember.deviceId),
      nextMember,
    ],
    invitations: params.authority.invitations.map((entry) =>
      entry.invite.inviteId === params.request.inviteId
        ? { ...entry, status: 'used' as const }
        : entry
    ),
    pendingRequests: params.authority.pendingRequests.filter(
      (r) => r.requestId !== params.request.requestId
    ),
    usedInviteIds: [...params.authority.usedInviteIds, params.request.inviteId],
  };

  return { grant, nextAuthority };
}

export async function verifyMembershipGrant(
  grant: SignedMembershipGrant | null | undefined,
  options?: {
    expectedDeviceId?: string;
    expectedOwnerFingerprint?: string;
    revokedDeviceIds?: string[];
    now?: number;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!grant || grant.version !== 1 || !grant.grantId || !grant.circleId) {
    return { ok: false, reason: 'Missing or malformed membership grant.' };
  }
  if (containsPrivateKeyMaterial(grant)) {
    return { ok: false, reason: 'Grant rejected: unexpected private key material.' };
  }
  if (options?.expectedDeviceId && grant.memberDeviceId !== options.expectedDeviceId) {
    return { ok: false, reason: 'Grant is bound to a different device.' };
  }
  if (
    options?.expectedOwnerFingerprint &&
    grant.ownerFingerprint !== options.expectedOwnerFingerprint
  ) {
    return { ok: false, reason: 'Grant owner authority does not match this circle.' };
  }
  if (options?.revokedDeviceIds?.includes(grant.memberDeviceId)) {
    return { ok: false, reason: 'This device has been revoked by the circle administrator.' };
  }
  const now = options?.now ?? Date.now();
  if (now > grant.expiresAt) {
    return { ok: false, reason: 'Membership grant has expired and must be renewed.' };
  }
  const ownerFp = await computePublicFingerprint(
    grant.ownerSignPubJwk,
    grant.ownerEcdhPubJwk
  );
  if (ownerFp !== grant.ownerFingerprint) {
    return { ok: false, reason: 'Owner fingerprint verification failed.' };
  }
  const { signature, ...unsigned } = grant;
  const sigOk = await verifySignature(grant.ownerSignPubJwk, unsigned, signature);
  if (!sigOk) {
    return { ok: false, reason: 'Invalid or forged membership grant signature.' };
  }
  return { ok: true };
}

export function revokeCircleDevice(
  authority: CircleAuthorityState,
  deviceId: string
): CircleAuthorityState {
  if (deviceId === authority.ownerDeviceId) {
    return authority;
  }
  const revokedDeviceIds = authority.revokedDeviceIds.includes(deviceId)
    ? authority.revokedDeviceIds
    : [...authority.revokedDeviceIds, deviceId];

  return {
    ...authority,
    revokedDeviceIds,
    members: authority.members.map((m) =>
      m.deviceId === deviceId ? { ...m, revoked: true } : m
    ),
  };
}

// PBKDF2 + AES-GCM Encrypted Recovery Kit (never embeds plaintext private keys in QR or share links)
export async function createEncryptedRecoveryKit(params: {
  passphrase: string;
  circleId: string;
  circleName: string;
  ownerKeys: DeviceKeyRecord;
  ownerName: string;
}): Promise<EncryptedRecoveryKit> {
  if (params.passphrase.trim().length < 8) {
    throw new Error('Recovery passphrase must be at least 8 characters.');
  }
  const cryptoApi = getWebCrypto();
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  cryptoApi.getRandomValues(salt);
  cryptoApi.getRandomValues(iv);

  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(params.passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const aesKey = await cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const recoverySecretPayload = JSON.stringify({
    circleId: params.circleId,
    circleName: params.circleName,
    ownerName: params.ownerName,
    ownerDeviceId: params.ownerKeys.deviceId,
    ownerFingerprint: params.ownerKeys.fingerprint,
    ownerSignPubJwk: params.ownerKeys.signPubJwk,
    ownerEcdhPubJwk: params.ownerKeys.ecdhPubJwk,
    recoveryNotice: 'Replacement devices must generate fresh keys and complete renewed authorization.',
    createdAt: Date.now(),
  });

  const cipherBuf = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(recoverySecretPayload)
  );

  return {
    version: 1,
    circleId: params.circleId,
    circleName: params.circleName,
    ownerName: params.ownerName,
    ownerDeviceId: params.ownerKeys.deviceId,
    ownerFingerprint: params.ownerKeys.fingerprint,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
    createdAt: Date.now(),
    requiresRenewedAuthorizationOnRestore: true,
  };
}

export async function restoreFromRecoveryKit(
  kit: EncryptedRecoveryKit,
  passphrase: string
): Promise<{
  circleId: string;
  circleName: string;
  ownerName: string;
  previousFingerprint: string;
  requiresRenewedAuthorization: true;
}> {
  const cryptoApi = getWebCrypto();
  const salt = base64ToBytes(kit.salt);
  const iv = base64ToBytes(kit.iv);
  const cipherBytes = base64ToBytes(kit.ciphertext);

  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const aesKey = await cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plainBuf = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    aesKey,
    toArrayBuffer(cipherBytes)
  );
  const parsed = JSON.parse(new TextDecoder().decode(plainBuf)) as {
    circleId: string;
    circleName: string;
    ownerName: string;
    ownerFingerprint: string;
  };
  return {
    circleId: parsed.circleId,
    circleName: parsed.circleName,
    ownerName: parsed.ownerName,
    previousFingerprint: parsed.ownerFingerprint,
    requiresRenewedAuthorization: true,
  };
}

/**
 * REMOVED: public metadata (circleId + ownerFingerprint) is not a secret and
 * must never derive a message key. Kept as a hard fail-closed guard so a
 * regression cannot silently reintroduce the vulnerability.
 */
function deriveCircleSessionKey(_circleId: string, _ownerFingerprint: string): never {
  throw new Error('SECURITY: public circle metadata must not be used as an encryption key');
}
void deriveCircleSessionKey;

// Fail-closed encryption: verifies valid active grant and excludes revoked devices from recipient list
export async function encryptCircleMessage(params: {
  plaintext: string;
  senderGrant: SignedMembershipGrant;
  authorityMembers: CircleMemberRecord[];
  revokedDeviceIds: string[];
  now?: number;
}): Promise<EncryptedEnvelope> {
  const grantCheck = await verifyMembershipGrant(params.senderGrant, {
    revokedDeviceIds: params.revokedDeviceIds,
    now: params.now,
  });
  if (!grantCheck.ok) {
    throw new Error(`Fail-closed: ${grantCheck.reason}`);
  }
  const activeMembers = params.authorityMembers.filter(
    (m) => !m.revoked && !params.revokedDeviceIds.includes(m.deviceId) && !!m.ecdhPubJwk,
  );
  const activeRecipients = activeMembers.map((m) => m.deviceId);

  if (!activeRecipients.includes(params.senderGrant.memberDeviceId)) {
    throw new Error('Fail-closed: sender device is not an active member of this circle.');
  }

  // Canonical per-recipient ECDH/HKDF/AES-GCM. Public circle metadata is never
  // used as key material; every copy is encrypted to one member's public ECDH key.
  const recipientEnvelopes: NonNullable<EncryptedEnvelope['recipientEnvelopes']> = [];
  for (const member of activeMembers) {
    const envelope = await encryptFor(
      params.plaintext,
      member.ecdhPubJwk,
      params.senderGrant.memberFingerprint,
    );
    recipientEnvelopes.push({ deviceId: member.deviceId, envelope });
  }

  return {
    version: 1,
    circleId: params.senderGrant.circleId,
    senderDeviceId: params.senderGrant.memberDeviceId,
    senderFingerprint: params.senderGrant.memberFingerprint,
    recipientEnvelopes,
    // Legacy shared-ciphertext fields are intentionally empty: no shared key exists.
    iv: '',
    ciphertext: '',
    recipientDeviceIds: activeRecipients,
    createdAt: params.now ?? Date.now(),
  };
}

export async function decryptCircleMessage(params: {
  envelope: EncryptedEnvelope;
  recipientGrant: SignedMembershipGrant | null | undefined;
  revokedDeviceIds: string[];
  now?: number;
}): Promise<string> {
  const grantCheck = await verifyMembershipGrant(params.recipientGrant, {
    revokedDeviceIds: params.revokedDeviceIds,
    now: params.now,
  });
  if (!grantCheck.ok || !params.recipientGrant) {
    throw new Error(`Fail-closed decrypt blocked: ${grantCheck.ok ? 'No grant' : grantCheck.reason}`);
  }
  if (params.envelope.circleId !== params.recipientGrant.circleId) {
    throw new Error('Fail-closed: envelope belongs to a different circle.');
  }
  if (!params.envelope.recipientDeviceIds.includes(params.recipientGrant.memberDeviceId)) {
    throw new Error('Fail-closed: this device is not an authorized recipient for this message.');
  }

  const copy = params.envelope.recipientEnvelopes?.find(
    (entry) => entry.deviceId === params.recipientGrant!.memberDeviceId,
  );
  if (!copy) {
    throw new Error('Fail-closed: no per-recipient encrypted copy for this device. Legacy shared-key envelopes are rejected.');
  }
  const deviceKeys = await loadDeviceKeysProtected(params.recipientGrant.memberDeviceId);
  if (!deviceKeys) {
    throw new Error('Fail-closed: protected device keys are unavailable.');
  }
  return decryptFrom({
    ...copy.envelope,
    alg: copy.envelope.alg as 'ECDH-P256/HKDF-SHA256/AES-256-GCM',
  }, deviceKeys.ecdhKeyPair.privateKey, params.envelope.senderFingerprint ?? '');
}
