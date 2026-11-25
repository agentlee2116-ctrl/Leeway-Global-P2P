/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.SIGN_IN_ACCESS
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Per-device offline sign-in passphrase verifier with retry cooldown
WHY: Require explicit user knowledge at every launch in addition to signed membership and device-key proof
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/signInAccess.ts
WHEN: 2026-11-24
HOW: Salted PBKDF2-SHA256 verifier in IndexedDB; no plaintext passphrase persistence or remote account
LICENSE: No new license asserted; preserve repository terms
*/
const DB_NAME = 'leeway-p2p-user-presence-v1';
const STORE_NAME = 'credentials';
const ITERATIONS = 350_000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000;

interface AccessRecord {
  deviceId: string;
  username?: string;
  salt: string;
  digest: string;
  iterations: number;
  failed: number;
  lockUntil: number;
  mustRotate?: boolean;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('Secure sign-in storage is unavailable on this device.');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME, { keyPath: 'deviceId' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Cannot open secure sign-in store.'));
  });
}

async function accessRecord(deviceId: string): Promise<AccessRecord | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(deviceId);
      req.onsuccess = () => resolve((req.result as AccessRecord | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('Cannot read sign-in state.'));
    });
  } finally { db.close(); }
}

async function saveRecord(record: AccessRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not securely save sign-in state.'));
      tx.onabort = () => reject(tx.error ?? new Error('Sign-in state write aborted.'));
    });
  } finally { db.close(); }
}

const toHex = (data: Uint8Array) => Array.from(data, (x) => x.toString(16).padStart(2, '0')).join('');
function fromHex(hex: string): Uint8Array {
  if (!/^(?:[\da-f]{2})+$/i.test(hex)) throw new Error('Invalid secure sign-in data.');
  return Uint8Array.from(hex.match(/.{2}/g)!, (x) => parseInt(x, 16));
}

async function passphraseDigest(passphrase: string, salt: Uint8Array, iterations: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`LeeWay-Global-P2P-User-Access-v1:${passphrase}`), 'PBKDF2', false, ['deriveBits']);
  const output = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, 256);
  return toHex(new Uint8Array(output));
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function hasAccessPassphrase(deviceId: string): Promise<boolean> {
  return (await accessRecord(deviceId)) !== null;
}

export async function getAccessUsername(deviceId: string): Promise<string | null> {
  return (await accessRecord(deviceId))?.username ?? null;
}

export async function needsPasswordRotation(deviceId: string): Promise<boolean> {
  return !!(await accessRecord(deviceId))?.mustRotate;
}

export async function establishAccessPassphrase(deviceId: string, passphrase: string): Promise<void> {
  if (!deviceId || passphrase.length < 12 || passphrase.length > 256) {
    throw new Error('Choose an access passphrase of at least 12 characters.');
  }
  if (await accessRecord(deviceId)) throw new Error('This device already has a sign-in passphrase.');
  const salt = crypto.getRandomValues(new Uint8Array(24));
  const digest = await passphraseDigest(passphrase, salt, ITERATIONS);
  await saveRecord({ deviceId, salt: toHex(salt), digest, iterations: ITERATIONS, failed: 0, lockUntil: 0 });
}

/** Creates the first device login from a signed invite's temporary password. */
export async function establishAccessCredential(
  deviceId: string,
  username: string,
  password: string,
): Promise<void> {
  if (!deviceId || !username || password.length < 8) {
    throw new Error('A username and a password of at least 8 characters are required.');
  }
  if (await accessRecord(deviceId)) throw new Error('This device already has a sign-in credential.');
  const salt = crypto.getRandomValues(new Uint8Array(24));
  const digest = await passphraseDigest(password, salt, ITERATIONS);
  await saveRecord({
    deviceId, username, salt: toHex(salt), digest, iterations: ITERATIONS,
    failed: 0, lockUntil: 0, mustRotate: true,
  });
}

/** Verifies the username and password bound to this device. */
export async function requireAccessCredential(
  deviceId: string,
  username: string,
  password: string,
  now = Date.now(),
): Promise<{ mustRotate: boolean }> {
  const record = await accessRecord(deviceId);
  if (!record) throw new Error('No device login is configured. Open your invitation link again.');
  if (record.lockUntil > now) throw new Error('Too many incorrect sign-in attempts. Please try again later.');
  const proposed = await passphraseDigest(password, fromHex(record.salt), record.iterations);
  if (!equalHex(proposed, record.digest) || (record.username && record.username !== username)) {
    const failed = record.failed + 1;
    await saveRecord({
      ...record, failed: failed >= MAX_ATTEMPTS ? 0 : failed,
      lockUntil: failed >= MAX_ATTEMPTS ? now + COOLDOWN_MS : 0,
    });
    throw new Error('Incorrect username or password. Access denied.');
  }
  if (record.failed || record.lockUntil) await saveRecord({ ...record, failed: 0, lockUntil: 0 });
  return { mustRotate: !!record.mustRotate };
}

/** First-login rotation: replaces the temporary invite password with a chosen one. */
export async function rotateAccessCredential(
  deviceId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const record = await accessRecord(deviceId);
  if (!record) throw new Error('No device login is configured.');
  const proposed = await passphraseDigest(currentPassword, fromHex(record.salt), record.iterations);
  if (!equalHex(proposed, record.digest)) throw new Error('Current password is incorrect.');
  if (newPassword.length < 12) throw new Error('Choose a new password of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(24));
  const digest = await passphraseDigest(newPassword, salt, ITERATIONS);
  await saveRecord({ ...record, salt: toHex(salt), digest, failed: 0, lockUntil: 0, mustRotate: false });
}

export async function requireAccessPassphrase(deviceId: string, passphrase: string, now = Date.now()): Promise<void> {
  const record = await accessRecord(deviceId);
  if (!record) throw new Error('No device sign-in passphrase is configured. Recovery is required.');
  if (record.lockUntil > now) throw new Error('Too many incorrect sign-in attempts. Please try again later.');
  const proposed = await passphraseDigest(passphrase, fromHex(record.salt), record.iterations);
  if (!equalHex(proposed, record.digest)) {
    const failed = record.failed + 1;
    await saveRecord({ ...record, failed: failed >= MAX_ATTEMPTS ? 0 : failed, lockUntil: failed >= MAX_ATTEMPTS ? now + COOLDOWN_MS : 0 });
    throw new Error('Incorrect passphrase. Access denied.');
  }
  if (record.failed || record.lockUntil) await saveRecord({ ...record, failed: 0, lockUntil: 0 });
}
