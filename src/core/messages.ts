/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.MESSAGES
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\messages.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/messages.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/** LeeWay Global P2P — message construction, signing, validation and expiry. */
import { canonicalJson, randomId, sign, verifySigned, sha256 } from './crypto.ts';
import type {
  AckPayload, DispatchBody, MediaMetadata, WireMessage, MessageKind, SignedEnvelope,
} from './types.ts';

export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function createMessage(params: {
  roomId: string;
  circleId?: string;
  kind: MessageKind;
  from: string;
  to?: string;
  recipients?: string[];
  body: string; // plaintext; encrypted before it leaves the device
  ttlMs?: number;
  privateSigningKey: CryptoKey;
  senderPublicJwk: JsonWebKey;
}): Promise<WireMessage> {
  const now = Date.now();
  const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
  const unsigned = {
    id: randomId(18),
    roomId: params.roomId,
    circleId: params.circleId,
    kind: params.kind,
    from: params.from,
    to: params.to,
    recipients: params.recipients,
    body: params.body,
    createdAt: now,
    expiresAt: now + ttl,
    nonce: randomId(12),
  };
  const signature = await sign(unsigned, params.privateSigningKey, params.from);
  return { ...unsigned, signature: signature.signature, acknowledgements: [] as SignedEnvelope<AckPayload>[] };
}

/** Signs the canonical message, excluding the signature and acknowledgements. */
export function signingPayload(message: WireMessage): Record<string, unknown> {
  return {
    id: message.id,
    roomId: message.roomId,
    circleId: message.circleId,
    kind: message.kind,
    from: message.from,
    to: message.to,
    recipients: message.recipients,
    body: message.body,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
    nonce: message.nonce,
  };
}

export async function verifyMessage(message: WireMessage, senderPublicJwk: JsonWebKey): Promise<boolean> {
  if (!message || typeof message.id !== 'string' || message.kind === undefined) return false;
  if (typeof message.signature !== 'string' || !message.signature) return false;
  const expected: SignedEnvelope<Record<string, unknown>> = {
    v: 1,
    payload: signingPayload(message),
    signer: message.from,
    signature: message.signature,
  };
  return verifySigned(expected, senderPublicJwk, message.from);
}

export function isExpired(message: WireMessage, now = Date.now()): boolean {
  return !message || typeof message.expiresAt !== 'number' || message.expiresAt <= now;
}

export async function messageDigest(message: WireMessage): Promise<string> {
  return sha256(canonicalJson(signingPayload(message)));
}

export async function createAck(
  message: WireMessage,
  recipientFingerprint: string,
  route: WireMessage['acknowledgements'][number]['payload']['route'],
  privateSigningKey: CryptoKey,
): Promise<SignedEnvelope<AckPayload>> {
  return sign(
    { messageId: message.id, recipient: recipientFingerprint, at: Date.now(), route },
    privateSigningKey,
    recipientFingerprint,
  );
}

export async function verifyAck(
  ack: SignedEnvelope<AckPayload>,
  recipientPublicJwk: JsonWebKey,
  messageId: string,
): Promise<boolean> {
  if (!ack?.payload || ack.payload.messageId !== messageId) return false;
  return verifySigned(ack, recipientPublicJwk, ack.payload.recipient);
}

export function addAck(message: WireMessage, ack: SignedEnvelope<AckPayload>): WireMessage {
  if (message.acknowledgements.some((a) => a.payload.recipient === ack.payload.recipient)) return message;
  return { ...message, acknowledgements: [...message.acknowledgements, ack] };
}

export function serializeMessage(message: WireMessage): string {
  return JSON.stringify(message);
}

export function deserializeMessage(raw: string): WireMessage {
  const parsed = JSON.parse(raw) as WireMessage;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    throw new Error('Invalid wire message');
  }
  return parsed;
}

/** Per-recipient delivery state. One member being offline never drops the dispatch for the others. */
export function deliveryMatrix(
  message: WireMessage,
  recipients?: Array<{ fingerprint: string; displayName?: string }>,
): Array<{ fingerprint: string; displayName?: string; acked: boolean; at?: number; route?: string }> {
  const target: Array<{ fingerprint: string; displayName?: string }> = recipients
    ?? (message.recipients ?? []).map((fingerprint) => ({ fingerprint }));
  return target.map((r) => {
    const ack = message.acknowledgements.find((a) => a.payload.recipient === r.fingerprint);
    return {
      fingerprint: r.fingerprint,
      displayName: r.displayName,
      acked: !!ack,
      at: ack?.payload.at,
      route: ack?.payload.route,
    };
  });
}

export function ackCountFor(message: WireMessage, recipients?: Array<{ fingerprint: string }>): number {
  return deliveryMatrix(message, recipients).filter((r) => r.acked).length;
}

/** A dispatch is fully delivered only when every intended recipient has signed. */
export function isFullyAcknowledged(message: WireMessage): boolean {
  const matrix = deliveryMatrix(message);
  return matrix.length > 0 && matrix.every((r) => r.acked);
}

/** Metadata stored in a dispatch body, if any. */
export function mediaMetadata(message: WireMessage): MediaMetadata | undefined {
  if (typeof message.body !== 'string') return undefined;
  try {
    const parsed = JSON.parse(message.body) as DispatchBody;
    return parsed?.v === 1 ? parsed.meta : undefined;
  } catch { return undefined; }
}
