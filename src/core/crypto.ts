/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CRYPTO
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\crypto.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/crypto.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/**
 * LeeWay Global P2P — cryptography.
 * Uses only platform WebCrypto (browser + Node 24). No external crypto libs.
 */
import type {
  DispatchBody,
  EncryptedEnvelope,
  IdentityPrivate,
  IdentityPublic,
  MediaMetadata,
  RecipientEnvelope,
  SignedEnvelope,
} from './types.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Deterministic JSON serialization (sorted keys) for signing and hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomId(bytes = 16): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return bytesToBase64(b).replace(/[+/=]/g, '').slice(0, 22);
}

export async function generateIdentity(displayName: string): Promise<IdentityPrivate> {
  const signing = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  );
  const agreement = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const signingJwk = await crypto.subtle.exportKey('jwk', (signing as CryptoKeyPair).publicKey);
  const agreementJwk = await crypto.subtle.exportKey('jwk', (agreement as CryptoKeyPair).publicKey);
  const fingerprint = await sha256(canonicalJson({ signing: signingJwk, agreement: agreementJwk }));
  const publicIdentity: IdentityPublic = {
    signing: signingJwk,
    agreement: agreementJwk,
    fingerprint,
    displayName,
  };
  return {
    signing: (signing as CryptoKeyPair).privateKey,
    agreement: (agreement as CryptoKeyPair).privateKey,
    public: publicIdentity,
  };
}

export async function importVerificationKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
}

export async function importAgreementKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

export async function sign<T>(payload: T, privateKey: CryptoKey, signer: string): Promise<SignedEnvelope<T>> {
  const signature = await crypto.subtle.sign('Ed25519', privateKey, enc.encode(canonicalJson(payload)));
  return { v: 1, payload, signer, signature: bytesToBase64(new Uint8Array(signature)) };
}

export async function verifySigned<T>(envelope: SignedEnvelope<T>, publicJwk: JsonWebKey, expectedSigner?: string): Promise<boolean> {
  if (envelope?.v !== 1 || !envelope.payload || !envelope.signature) return false;
  if (expectedSigner && envelope.signer !== expectedSigner) return false;
  try {
    const key = await importVerificationKey(publicJwk);
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      base64ToBytes(envelope.signature) as BufferSource,
      enc.encode(canonicalJson(envelope.payload)),
    );
  } catch {
    return false;
  }
}

async function deriveKey(sharedBits: ArrayBuffer, salt: Uint8Array, info: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptFor(plaintext: string, recipientAgreementJwk: JsonWebKey, senderFingerprint: string): Promise<EncryptedEnvelope> {
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  ) as CryptoKeyPair;
  const recipientKey = await importAgreementKey(recipientAgreementJwk);
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    ephemeral.privateKey,
    256,
  );
  const ephemeralJwk = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(senderFingerprint)));
  const info = enc.encode('leeway-global-p2p/v1/message');
  const key = await deriveKey(bits, salt, info);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext),
  );
  return {
    v: 1,
    alg: 'ECDH-P256/HKDF-SHA256/AES-256-GCM',
    ephemeral: ephemeralJwk,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptFrom(envelope: EncryptedEnvelope, recipientPrivateAgreement: CryptoKey, senderFingerprint: string): Promise<string> {
  if (envelope?.v !== 1 || envelope.alg !== 'ECDH-P256/HKDF-SHA256/AES-256-GCM') {
    throw new Error('Unsupported encrypted envelope');
  }
  const ephemeralPub = await importAgreementKey(envelope.ephemeral);
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPub },
    recipientPrivateAgreement,
    256,
  );
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(senderFingerprint)));
  const key = await deriveKey(bits, salt, enc.encode('leeway-global-p2p/v1/message'));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource },
    key,
    base64ToBytes(envelope.ciphertext) as BufferSource,
  );
  return dec.decode(plain);
}

/**
 * Encrypts one dispatch separately for every room member. Each copy is bound
 * to that recipient's agreement key and the sender fingerprint, so a relay or
 * gateway cannot read it and one member cannot decrypt another's copy.
 */
export async function encryptForRecipients(params: {
  plaintext: string;
  recipients: Array<{ fingerprint: string; agreement: JsonWebKey }>;
  senderFingerprint: string;
  meta?: MediaMetadata;
}): Promise<string> {
  const unique = new Map<string, { fingerprint: string; agreement: JsonWebKey }>();
  for (const r of params.recipients) if (r.fingerprint && r.agreement) unique.set(r.fingerprint, r);
  const recipients: RecipientEnvelope[] = [];
  for (const r of unique.values()) {
    recipients.push({
      recipient: r.fingerprint,
      envelope: await encryptFor(params.plaintext, r.agreement, params.senderFingerprint),
    });
  }
  const body: DispatchBody = { v: 1, recipients, meta: params.meta };
  if (!params.meta) body.text = params.plaintext;
  return JSON.stringify(body);
}

/** Decrypts the copy addressed to this device. Accepts legacy single-envelope bodies. */
export async function decryptDispatchBody(params: {
  body: string;
  selfFingerprint: string;
  selfAgreementPrivate: CryptoKey;
  senderFingerprint: string;
}): Promise<{ plaintext: string; meta?: MediaMetadata }> {
  const parsed = JSON.parse(params.body);
  if (parsed?.v === 1 && Array.isArray(parsed.recipients)) {
    const match = (parsed.recipients as RecipientEnvelope[])
      .find((r) => r.recipient === params.selfFingerprint);
    if (!match) throw new Error('This dispatch has no copy addressed to this device');
    const plaintext = await decryptFrom(match.envelope, params.selfAgreementPrivate, params.senderFingerprint);
    return { plaintext, meta: parsed.meta as MediaMetadata | undefined };
  }
  // Legacy direct message: a single EncryptedEnvelope.
  const plaintext = await decryptFrom(parsed as EncryptedEnvelope, params.selfAgreementPrivate, params.senderFingerprint);
  return { plaintext };
}

/** Ed25519-signed, time-bounded authorization token used by gateway declarations. */
export async function issueCapability(
  scope: string[],
  rights: Array<'send' | 'receive' | 'ack'>,
  issuerPrivateKey: CryptoKey,
  issuerFingerprint: string,
  ttlMs = 10 * 60 * 1000,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlMs;
  const signed = await sign({ scope, rights, expiresAt, n: randomId(8) }, issuerPrivateKey, issuerFingerprint);
  return { token: JSON.stringify(signed), expiresAt };
}

export async function verifyCapability(
  token: string,
  issuerPublicJwk: JsonWebKey,
  expectedScope: string,
  requiredRight: 'send' | 'receive' | 'ack',
  now = Date.now(),
): Promise<{ ok: boolean; reason?: string; scope?: string[]; rights?: string[] }> {
  let parsed: SignedEnvelope<{ scope: string[]; rights: string[]; expiresAt: number; n: string }>;
  try {
    parsed = JSON.parse(token);
  } catch {
    return { ok: false, reason: 'malformed authorization token' };
  }
  if (!parsed?.payload || typeof parsed.payload.expiresAt !== 'number') {
    return { ok: false, reason: 'invalid authorization token structure' };
  }
  if (parsed.payload.expiresAt <= now) return { ok: false, reason: 'authorization token expired' };
  const valid = await verifySigned(parsed, issuerPublicJwk);
  if (!valid) return { ok: false, reason: 'authorization token signature invalid' };
  const scope = parsed.payload.scope ?? [];
  const rights = parsed.payload.rights ?? [];
  if (!scope.includes('*') && !scope.includes(expectedScope)) {
    return { ok: false, reason: 'authorization token does not cover this room', scope, rights };
  }
  if (!rights.includes(requiredRight)) {
    return { ok: false, reason: `authorization token lacks '${requiredRight}' right`, scope, rights };
  }
  return { ok: true, scope, rights };
}
