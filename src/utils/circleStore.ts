/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CIRCLESTORE
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\circleStore.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/circleStore.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import {
  containsPrivateKeyMaterial,
  loadDeviceKeysProtected,
  verifyMembershipGrant,
  type CircleAuthorityState,
  type DeviceKeyRecord,
  type EncryptedEnvelope,
  type JoinRequestBundle,
  type SignedInvitation,
  type SignedMembershipGrant,
} from './enrollmentCrypto';

export interface EnrollmentSession {
  version: 1;
  deviceId: string;
  role: 'owner' | 'member';
  userName: string;
  circleId: string;
  circleName: string;
  deviceLockEnabled: boolean;
  grant: SignedMembershipGrant;
  authority?: CircleAuthorityState;
  recoveryKitCreatedAt?: number;
  accessPassphraseConfigured?: boolean;
  enrolledAt: number;
}

export interface PendingMemberEnrollment {
  version: 1;
  invite: SignedInvitation;
  memberDeviceId: string;
  memberName: string;
  deviceLockEnabled: boolean;
  joinRequest: JoinRequestBundle;
  safetyCode: string;
  createdAt: number;
}

export interface StoredCircleEnvelope {
  id: string;
  kind: 'voice' | 'text' | 'snap';
  circleId: string;
  senderName: string;
  senderDeviceId: string;
  queued: boolean;
  createdAt: number;
  envelope: EncryptedEnvelope;
}

export type BootGateResult =
  | {
      status: 'enrolled';
      session: EnrollmentSession;
      keys: DeviceKeyRecord;
    }
  | {
      status: 'pending';
      pending: PendingMemberEnrollment;
    }
  | {
      status: 'locked';
      reason?: string;
    };

export type TokenPrefix = 'LWINV1' | 'LWREQ1' | 'LWGRT1';

export type RelaySyncMessage =
  | { type: 'JOIN_REQUEST'; circleId: string; request: JoinRequestBundle }
  | { type: 'MEMBERSHIP_GRANT'; circleId: string; memberDeviceId: string; grant: SignedMembershipGrant }
  | { type: 'REVOCATION_LIST'; circleId: string; revokedDeviceIds: string[] }
  | { type: 'ENCRYPTED_DISPATCH'; circleId: string; item: StoredCircleEnvelope };

const APP_DB_NAME = 'leeway-app-state';
const KV_STORE = 'kv';
const RELAY_STORE = 'relay_mailbox';
const SESSION_KEY = 'enrollment_session';
const PENDING_KEY = 'pending_member_enrollment';
const ENVELOPES_KEY = 'encrypted_envelopes';
const REVOCATIONS_KEY = 'known_revocations';

const memoryKv = new Map<string, unknown>();
const memoryRelay = new Map<string, unknown>();

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUtf8(b64Url: string): string {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeBundleToken(prefix: TokenPrefix, payload: unknown): string {
  if (containsPrivateKeyMaterial(payload)) {
    throw new Error('Private key material cannot be encoded into shareable tokens.');
  }
  return `${prefix}:${utf8ToBase64Url(JSON.stringify(payload))}`;
}

export function encodeInviteShareUrl(
  invite: SignedInvitation,
  baseUrl = 'https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/join/',
): string {
  const token = encodeBundleToken('LWINV1', invite);
  return `${baseUrl}?invite=${encodeURIComponent(token)}`;
}

export function parseBundleInput<T = unknown>(
  rawInput: string,
  expectedPrefix?: TokenPrefix
): { ok: true; data: T } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste an invitation, link, or token before continuing.' };
  }

  let candidate = trimmed;

  // Support URL forms like https://.../?invite=LWINV1:... or #invite=...
  if (/^https?:\/\//i.test(candidate) || candidate.includes('invite=')) {
    try {
      const normalized = /^https?:\/\//i.test(candidate)
        ? candidate
        : `https://leeway.p2p/${candidate.startsWith('?') ? candidate : `?${candidate}`}`;
      const url = new URL(normalized);
      const fromQuery = url.searchParams.get('invite') || url.searchParams.get('token');
      const fromHash = url.hash ? new URLSearchParams(url.hash.replace(/^#/, '')).get('invite') : null;
      const extracted = fromQuery || fromHash;
      if (extracted) {
        candidate = extracted.trim();
      }
    } catch {
      // Fall through to token/JSON parsing
    }
  }

  try {
    let parsed: unknown;
    const prefixMatch = candidate.match(/^(LWINV1|LWREQ1|LWGRT1):([A-Za-z0-9_-]+)$/);
    if (prefixMatch) {
      const [, prefix, encoded] = prefixMatch;
      if (expectedPrefix && prefix !== expectedPrefix) {
        return { ok: false, error: 'This code is a different bundle type than expected here.' };
      }
      parsed = JSON.parse(base64UrlToUtf8(encoded));
    } else {
      parsed = JSON.parse(candidate);
    }

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Unrecognized invitation or bundle format.' };
    }
    if (containsPrivateKeyMaterial(parsed)) {
      return {
        ok: false,
        error: 'Rejected: bundles containing private key material are never accepted.',
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, error: 'Could not read that invitation or signed file. Check the contents and try again.' };
  }
}

export function scrubLegacyLocalStorageSecrets(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const val = window.localStorage.getItem(key) ?? '';
      if (
        /"d"\s*:/.test(val) ||
        /"privateKey"\s*:/.test(val) ||
        /jwk/i.test(key) ||
        /private.?key/i.test(key)
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore storage access restrictions
  }
}

async function openAppDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(APP_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
        if (!db.objectStoreNames.contains(RELAY_STORE)) {
          db.createObjectStore(RELAY_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(storeName: string, key: string, fallbackMap: Map<string, unknown>): Promise<T | null> {
  if (fallbackMap.has(key)) {
    return (fallbackMap.get(key) as T) ?? null;
  }
  const db = await openAppDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => {
        const val = (req.result as T | undefined) ?? null;
        if (val !== null) fallbackMap.set(key, val);
        resolve(val);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(storeName: string, key: string, value: T, fallbackMap: Map<string, unknown>): Promise<void> {
  fallbackMap.set(key, value);
  const db = await openAppDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(storeName: string, key: string, fallbackMap: Map<string, unknown>): Promise<void> {
  fallbackMap.delete(key);
  const db = await openAppDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function saveEnrollmentSession(session: EnrollmentSession): Promise<void> {
  await idbSet(KV_STORE, SESSION_KEY, session, memoryKv);
}

export async function loadEnrollmentSession(): Promise<EnrollmentSession | null> {
  return idbGet<EnrollmentSession>(KV_STORE, SESSION_KEY, memoryKv);
}

export async function clearEnrollmentSession(): Promise<void> {
  await idbDelete(KV_STORE, SESSION_KEY, memoryKv);
}

export async function savePendingMemberEnrollment(pending: PendingMemberEnrollment): Promise<void> {
  await idbSet(KV_STORE, PENDING_KEY, pending, memoryKv);
}

export async function loadPendingMemberEnrollment(): Promise<PendingMemberEnrollment | null> {
  return idbGet<PendingMemberEnrollment>(KV_STORE, PENDING_KEY, memoryKv);
}

export async function clearPendingMemberEnrollment(): Promise<void> {
  await idbDelete(KV_STORE, PENDING_KEY, memoryKv);
}

export async function saveStoredEnvelopes(circleId: string, items: StoredCircleEnvelope[]): Promise<void> {
  await idbSet(KV_STORE, `${ENVELOPES_KEY}:${circleId}`, items, memoryKv);
}

export async function loadStoredEnvelopes(circleId: string): Promise<StoredCircleEnvelope[]> {
  return (await idbGet<StoredCircleEnvelope[]>(KV_STORE, `${ENVELOPES_KEY}:${circleId}`, memoryKv)) ?? [];
}

export async function saveKnownRevocations(circleId: string, revokedIds: string[]): Promise<void> {
  await idbSet(RELAY_STORE, `${REVOCATIONS_KEY}:${circleId}`, revokedIds, memoryRelay);
}

export async function loadKnownRevocations(circleId: string): Promise<string[]> {
  return (await idbGet<string[]>(RELAY_STORE, `${REVOCATIONS_KEY}:${circleId}`, memoryRelay)) ?? [];
}

// Relay mailbox helpers (for multi-tab or offline-delayed local relay queue; never bypasses owner crypto verification)
export async function pushRelayJoinRequest(request: JoinRequestBundle): Promise<void> {
  const key = `join_requests:${request.circleId}`;
  const current = (await idbGet<JoinRequestBundle[]>(RELAY_STORE, key, memoryRelay)) ?? [];
  const next = [request, ...current.filter((r) => r.requestId !== request.requestId)];
  await idbSet(RELAY_STORE, key, next, memoryRelay);
  broadcastSyncEvent({ type: 'JOIN_REQUEST', circleId: request.circleId, request });
}

export async function loadRelayJoinRequests(circleId: string): Promise<JoinRequestBundle[]> {
  return (await idbGet<JoinRequestBundle[]>(RELAY_STORE, `join_requests:${circleId}`, memoryRelay)) ?? [];
}

export async function removeRelayJoinRequest(circleId: string, requestId: string): Promise<void> {
  const key = `join_requests:${circleId}`;
  const current = (await idbGet<JoinRequestBundle[]>(RELAY_STORE, key, memoryRelay)) ?? [];
  await idbSet(
    RELAY_STORE,
    key,
    current.filter((r) => r.requestId !== requestId),
    memoryRelay
  );
}

export async function publishRelayMembershipGrant(grant: SignedMembershipGrant): Promise<void> {
  await idbSet(RELAY_STORE, `grant:${grant.memberDeviceId}`, grant, memoryRelay);
  broadcastSyncEvent({
    type: 'MEMBERSHIP_GRANT',
    circleId: grant.circleId,
    memberDeviceId: grant.memberDeviceId,
    grant,
  });
}

export async function loadRelayMembershipGrant(memberDeviceId: string): Promise<SignedMembershipGrant | null> {
  return idbGet<SignedMembershipGrant>(RELAY_STORE, `grant:${memberDeviceId}`, memoryRelay);
}

export async function publishRevocationList(circleId: string, revokedDeviceIds: string[]): Promise<void> {
  await saveKnownRevocations(circleId, revokedDeviceIds);
  broadcastSyncEvent({ type: 'REVOCATION_LIST', circleId, revokedDeviceIds });
}

/* BroadcastChannel stays local-tab-only. A real relay transport may be bound by
 * the communications bridge; enrollment messages are then delivered cross-device
 * while the existing signature/revocation checks remain the authorization gate. */
let relaySyncSender: ((message: RelaySyncMessage) => void) | null = null;
const remoteSyncHandlers = new Set<(message: RelaySyncMessage) => void>();

export function setRelaySyncTransport(send: (message: RelaySyncMessage) => void): void {
  relaySyncSender = send;
}

export function receiveRelaySyncEvent(message: RelaySyncMessage | null | undefined): void {
  if (!message || typeof message !== 'object') return;
  remoteSyncHandlers.forEach((handler) => handler(message));
}

export function broadcastSyncEvent(message: RelaySyncMessage): void {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('leeway-p2p-sync');
      channel.postMessage(message);
      channel.close();
    } catch {
      // Ignore environments without BroadcastChannel
    }
  }
  relaySyncSender?.(message);
}

export function subscribeSyncEvents(handler: (message: RelaySyncMessage) => void): () => void {
  remoteSyncHandlers.add(handler);
  let closeLocal: (() => void) | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('leeway-p2p-sync');
      channel.onmessage = (ev: MessageEvent<RelaySyncMessage>) => {
        if (ev.data && typeof ev.data === 'object') handler(ev.data);
      };
      closeLocal = () => channel.close();
    } catch {
      closeLocal = null;
    }
  }
  return () => { remoteSyncHandlers.delete(handler); closeLocal?.(); };
}

// Fail-closed startup gate: verifies device keys, lock confirmation, and signed non-revoked grant
export async function evaluateEnrollmentGate(now?: number): Promise<BootGateResult> {
  scrubLegacyLocalStorageSecrets();
  const session = await loadEnrollmentSession();

  if (session) {
    const keys = await loadDeviceKeysProtected(session.deviceId);
    if (!keys) {
      return {
        status: 'locked',
        reason: 'Protected device keys were not found on this device. Re-enroll or restore your recovery kit.',
      };
    }
    if (!session.deviceLockEnabled) {
      return {
        status: 'locked',
        reason: 'Device protection must be enabled before unlocking encrypted communications.',
      };
    }

    const relayRevocations = await loadKnownRevocations(session.circleId);
    const mergedRevocations = Array.from(
      new Set([...(session.authority?.revokedDeviceIds ?? []), ...relayRevocations])
    );

    const check = await verifyMembershipGrant(session.grant, {
      expectedDeviceId: session.deviceId,
      revokedDeviceIds: mergedRevocations,
      now,
    });

    if (!check.ok) {
      return { status: 'locked', reason: check.reason };
    }

    return { status: 'enrolled', session, keys };
  }

  const pending = await loadPendingMemberEnrollment();
  if (pending) {
    const keys = await loadDeviceKeysProtected(pending.memberDeviceId);
    if (keys) {
      return { status: 'pending', pending };
    }
    await clearPendingMemberEnrollment();
  }

  return { status: 'locked' };
}

export function downloadJsonFile(filename: string, data: unknown): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
