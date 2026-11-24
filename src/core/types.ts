/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TYPES
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\types.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/types.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/**
 * LeeWay Global P2P — shared domain types.
 *
 * All wire types are JSON-safe and versioned. Nothing in this file grants
 * permission to transmit: transport capability is decided by transport.ts.
 */

/** Unified walkie-talkie dispatch kinds. Nothing here is a live call. */
export type MessageKind = 'text' | 'ptt' | 'snap' | 'file' | 'control' | 'ack';

/** Metadata for a self-contained media burst (voice clip, photo or video snap). */
export interface MediaMetadata {
  media: 'audio' | 'photo' | 'video' | 'file';
  mime: string;
  name: string;
  sha256: string;
  size: number;
  durationMs?: number;
  width?: number;
  height?: number;
  ptt?: boolean;
}

/** One encrypted copy of a dispatch body, addressed to a room member. */
export interface RecipientEnvelope {
  recipient: string;
  envelope: EncryptedEnvelope;
}

/** Wire body for a dispatch addressed to one or many room members. */
export interface DispatchBody {
  v: 1;
  meta?: MediaMetadata;
  recipients: RecipientEnvelope[];
  text?: string;
}

export interface IdentityPublic {
  /** Ed25519 verification key (JWK, public only). */
  signing: JsonWebKey;
  /** ECDH P-256 agreement key (JWK, public only). */
  agreement: JsonWebKey;
  /** SHA-256 of the canonical public material. Stable peer identifier. */
  fingerprint: string;
  /** Human-chosen display name. */
  displayName: string;
}

export interface IdentityPrivate {
  signing: CryptoKey;
  agreement: CryptoKey;
  public: IdentityPublic;
}

export interface EncryptedEnvelope {
  v: 1;
  alg: 'ECDH-P256/HKDF-SHA256/AES-256-GCM';
  ephemeral: JsonWebKey;
  iv: string; // base64
  ciphertext: string; // base64
}

export interface SignedEnvelope<T> {
  v: 1;
  payload: T;
  signer: string; // fingerprint
  signature: string; // base64, Ed25519 over canonical(payload)
}

export interface WireMessage {
  id: string;
  roomId: string;
  /** Private circle this dispatch belongs to (signed with the message). */
  circleId?: string;
  kind: MessageKind;
  from: string;
  to?: string;
  /** Room members this dispatch was encrypted for (signed, per-recipient tracking). */
  recipients?: string[];
  /** Plaintext only in local UI state. On the wire this is an EncryptedEnvelope. */
  body: EncryptedEnvelope | string;
  createdAt: number;
  expiresAt: number;
  nonce: string;
  /** Signature over everything above except this field. */
  signature: string;
  /** Signed delivery acknowledgements from recipients. */
  acknowledgements: SignedEnvelope<AckPayload>[];
}

export interface AckPayload {
  messageId: string;
  recipient: string;
  at: number;
  route: RouteKind;
}

export interface Attachment {
  name: string;
  mime: string;
  size: number;
  /** base64 of the encrypted EncryptedEnvelope JSON. */
  encryptedBytes: string;
  sha256: string;
}

export interface QueuedMessage {
  message: WireMessage;
  attempts: number;
  lastAttemptAt?: number;
  status: 'queued' | 'sent' | 'delivered' | 'expired' | 'failed';
  route?: RouteKind;
  error?: string;
}

export type RouteKind =
  | 'direct-webrtc'
  | 'local-lan'
  | 'community-mesh'
  | 'public-mesh-gateway'
  | 'satellite-gateway'
  | 'internet-relay'
  | 'physical-transfer';

export interface GatewayDeclaration {
  /** Stable identifier of the gateway instance. */
  id: string;
  kind: RouteKind;
  /** Authority that issued the declaration (LeeWay Device Bridge / Federate). */
  issuer: string;
  /** Signature by the issuer over the canonical declaration body. */
  signature: string;
  /** Short-lived authorization token issued by the owning authority. */
  authorization: {
    token: string;
    expiresAt: number;
    scope: string[]; // room ids or '*'
    rights: Array<'send' | 'receive' | 'ack'>;
  };
  /** Capabilities advertised by the gateway. */
  capabilities: {
    endToEndEncryption: boolean;
    bidirectional: boolean;
    linkQuality: number; // 0..1
    maxPayloadBytes: number;
  };
  /** Implementation annotation. 'unverified' can never qualify a route. */
  verification: 'verified' | 'candidate' | 'unverified';
  /** Transport-specific endpoint (ws://, mqtt://, serial path, etc.). */
  endpoint?: string;
  /** Optional human-readable note. */
  note?: string;
}

export interface RouteQualification {
  qualified: boolean;
  route: RouteKind;
  gatewayId: string;
  reasons: string[];
  checkedAt: number;
}

export interface LinkStatus {
  route: RouteKind | null;
  label: string;
  connected: boolean;
  detail: string;
  updatedAt: number;
}

/** A known member of a family/room, including presence across regions. */
export interface PeerRecord extends IdentityPublic {
  addedAt: number;
  lastSeen?: number;
  online?: boolean;
  region?: string;
}

export interface PairingInvitation {
  v: 1;
  displayName: string;
  fingerprint: string;
  roomId: string;
  relayUrl?: string;
  createdAt: number;
}
