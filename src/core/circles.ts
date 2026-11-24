/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CIRCLES
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Private circle identity and revocable, time-bound service grants
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/circles.ts
WHY: Family rooms need verifiable membership and service windows that expire or can be revoked
HOW: Ed25519-signed capability tokens checked locally and by authorized service routes; no plaintext exposed
*/
import { canonicalJson, randomId, sha256, sign, verifySigned } from './crypto.ts';
import type { SignedEnvelope } from './types.ts';

export const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type GrantScope = 'relay' | 'mesh' | 'satellite' | 'service';
export type GrantRight = 'join' | 'send' | 'receive' | 'ack';

export interface CircleRecord {
  circleId: string;
  name: string;
  createdAt: number;
  expiresAt?: number;
  members: string[];
  issuer: string;
}

export interface ServiceGrantPayload {
  grantId: string;
  circleId: string;
  scope: GrantScope;
  rights: GrantRight[];
  issuedAt: number;
  expiresAt: number;
  fingerprint: string;
}

export interface ServiceGrant {
  token: string; // SignedEnvelope<ServiceGrantPayload> JSON
  payload: ServiceGrantPayload;
  status: 'active' | 'expired' | 'revoked';
}

export class RevocationList {
  private revoked = new Set<string>();

  revoke(grantId: string): void { this.revoked.add(grantId); }
  restore(grantId: string): void { this.revoked.delete(grantId); }
  isRevoked(grantId: string): boolean { return this.revoked.has(grantId); }
  list(): string[] { return [...this.revoked]; }
  import(ids: string[]): void { ids.forEach((id) => id && this.revoked.add(id)); }
}

export function circleIdFromName(name: string, salt = randomId(12)): string {
  return `circle-${salt}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
}

export async function issueServiceGrant(params: {
  circleId: string;
  scope: GrantScope;
  rights: GrantRight[];
  fingerprint: string;
  issuerPrivateKey: CryptoKey;
  issuerFingerprint: string;
  windowMs?: number;
  now?: number;
}): Promise<ServiceGrant> {
  const now = params.now ?? Date.now();
  const payload: ServiceGrantPayload = {
    grantId: randomId(16),
    circleId: params.circleId,
    scope: params.scope,
    rights: [...new Set(params.rights)],
    issuedAt: now,
    expiresAt: now + (params.windowMs ?? SIX_MONTHS_MS),
    fingerprint: params.fingerprint,
  };
  const signed = await sign(payload, params.issuerPrivateKey, params.issuerFingerprint);
  return { token: JSON.stringify(signed), payload, status: 'active' };
}

export interface CircleValidation {
  ok: boolean;
  reason?: string;
  status?: ServiceGrant['status'];
}

/** Verifies circle membership, grant signature, expiry, revocation and required right. */
export async function validateCircleAccess(params: {
  circle?: CircleRecord;
  grant: ServiceGrant | string;
  issuerPublicJwk: JsonWebKey;
  requiredRight: GrantRight;
  requiredScope?: GrantScope;
  revocations?: RevocationList;
  now?: number;
}): Promise<CircleValidation> {
  const now = params.now ?? Date.now();
  let signed: SignedEnvelope<ServiceGrantPayload>;
  try {
    signed = typeof params.grant === 'string' ? JSON.parse(params.grant) : JSON.parse(params.grant.token);
  } catch { return { ok: false, reason: 'malformed service grant', status: 'revoked' }; }

  if (!(await verifySigned(signed, params.issuerPublicJwk))) {
    return { ok: false, reason: 'service grant signature invalid', status: 'revoked' };
  }
  const payload = signed.payload;
  if (!payload?.grantId || !payload.circleId || typeof payload.expiresAt !== 'number') {
    return { ok: false, reason: 'incomplete service grant', status: 'revoked' };
  }
  if (params.circle && payload.circleId !== params.circle.circleId) {
    return { ok: false, reason: 'grant belongs to a different circle', status: 'revoked' };
  }
  if (params.circle?.expiresAt && params.circle.expiresAt <= now) {
    return { ok: false, reason: 'circle service window expired', status: 'expired' };
  }
  if (params.revocations?.isRevoked(payload.grantId)) {
    return { ok: false, reason: 'service grant revoked', status: 'revoked' };
  }
  if (payload.expiresAt <= now) {
    return { ok: false, reason: 'service grant expired', status: 'expired' };
  }
  if (params.requiredScope && payload.scope !== params.requiredScope && payload.scope !== 'service') {
    return { ok: false, reason: `grant scope '${payload.scope}' does not cover '${params.requiredScope}'`, status: 'active' };
  }
  if (!payload.rights.includes(params.requiredRight)) {
    return { ok: false, reason: `grant lacks '${params.requiredRight}' right`, status: 'active' };
  }
  if (params.circle && !params.circle.members.includes(payload.fingerprint)) {
    return { ok: false, reason: 'grant fingerprint is not a circle member', status: 'active' };
  }
  return { ok: true, status: 'active' };
}

export function grantSummary(grant: ServiceGrant): string {
  const days = Math.max(0, Math.ceil((grant.payload.expiresAt - Date.now()) / 86_400_000));
  return `${grant.payload.scope} · ${grant.payload.rights.join('+')} · ${days} day(s) remaining · ${grant.status}`;
}

export async function circleDigest(circle: CircleRecord): Promise<string> {
  return sha256(canonicalJson(circle));
}
