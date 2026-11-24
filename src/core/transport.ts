/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TRANSPORT
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\transport.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/transport.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/**
 * LeeWay Global P2P — mesh/satellite transport adapter.
 *
 * This is the repair for the "carrier-only" defect: the app routes over the
 * LeeWay mesh (Device Bridge / Federate) and authorized community/satellite
 * gateways. It NEVER fabricates connectivity. A route qualifies only when the
 * issuing authority is known, the capability token is valid and unexpired, the
 * room is in scope, the required right is granted, E2E encryption is available,
 * bidirectional operation is available when acknowledgements are required, the
 * declared verification is 'verified', and link quality clears the threshold.
 */
import { canonicalJson, issueCapability, sha256, sign, verifyCapability, verifySigned } from './crypto.ts';
import { isExpired, verifyAck, verifyMessage } from './messages.ts';
import type {
  AckPayload,
  GatewayDeclaration,
  LinkStatus,
  RouteKind,
  RouteQualification,
  SignedEnvelope,
  WireMessage,
} from './types.ts';

export const MIN_LINK_QUALITY = 0.35;

export interface AuthorityRecord {
  id: string;
  label: string;
  publicJwk: JsonWebKey;
  /** 'leeway-device-bridge' | 'leeway-federate' | external authority id */
  source: string;
  trustedAt: number;
}

export interface SendOutcome {
  ok: boolean;
  route?: RouteKind;
  gatewayId?: string;
  reason?: string;
  acks: SignedEnvelope<AckPayload>[];
}

export interface ReceiveOutcome {
  accepted: boolean;
  reason?: string;
  message?: WireMessage;
  route?: RouteKind;
}

export type GatewaySink = (message: WireMessage, gateway: GatewayDeclaration) => Promise<void>;

/**
 * Registry of authorities allowed to issue gateway capability tokens.
 * Populate from LeeWay Device Bridge / Federate at runtime; never hard-code
 * a third-party key as trusted.
 */
export class AuthorityRegistry {
  private authorities = new Map<string, AuthorityRecord>();

  add(record: AuthorityRecord): void {
    this.authorities.set(record.id, record);
  }

  remove(id: string): void {
    this.authorities.delete(id);
  }

  get(id: string): AuthorityRecord | undefined {
    return this.authorities.get(id);
  }

  list(): AuthorityRecord[] {
    return [...this.authorities.values()];
  }

  async verifyGatewaySignature(declaration: GatewayDeclaration): Promise<boolean> {
    const authority = this.authorities.get(declaration.issuer);
    if (!authority) return false;
    const body = gatewaySigningBody(declaration);
    return verifySigned(
      { v: 1, payload: body, signer: declaration.issuer, signature: declaration.signature },
      authority.publicJwk,
      declaration.issuer,
    );
  }
}

export function gatewaySigningBody(g: GatewayDeclaration): Record<string, unknown> {
  return {
    id: g.id,
    kind: g.kind,
    issuer: g.issuer,
    authorization: g.authorization,
    capabilities: g.capabilities,
    verification: g.verification,
    endpoint: g.endpoint,
  };
}

export async function declareGateway(params: {
  id: string;
  kind: RouteKind;
  issuer: string;
  scope: string[];
  rights: Array<'send' | 'receive' | 'ack'>;
  verification: GatewayDeclaration['verification'];
  linkQuality: number;
  endpoint?: string;
  note?: string;
  maxPayloadBytes?: number;
  issuerPrivateKey: CryptoKey;
  ttlMs?: number;
}): Promise<GatewayDeclaration> {
  const capability = await issueCapability(params.scope, params.rights, params.issuerPrivateKey, params.issuer, params.ttlMs);
  const base: GatewayDeclaration = {
    id: params.id,
    kind: params.kind,
    issuer: params.issuer,
    signature: '',
    authorization: {
      token: capability.token,
      expiresAt: capability.expiresAt,
      scope: params.scope,
      rights: params.rights,
    },
    capabilities: {
      endToEndEncryption: true,
      bidirectional: params.rights.includes('ack') && params.rights.includes('send'),
      linkQuality: params.linkQuality,
      maxPayloadBytes: params.maxPayloadBytes ?? 256 * 1024,
    },
    verification: params.verification,
    endpoint: params.endpoint,
    note: params.note,
  };
  const signature = await sign(gatewaySigningBody(base), params.issuerPrivateKey, params.issuer);
  return { ...base, signature: signature.signature };
}

export interface QualificationContext {
  roomId: string;
  now?: number;
}

/** Pure qualification check; also exported for negative-case tests. */
export async function qualifyGateway(
  declaration: GatewayDeclaration,
  authorityRegistry: AuthorityRegistry,
  context: QualificationContext,
  requiredRight: 'send' | 'receive' | 'ack' = 'send',
): Promise<RouteQualification> {
  const now = context.now ?? Date.now();
  const reasons: string[] = [];
  const fail = (reason: string) => {
    reasons.push(reason);
    return { qualified: false, route: declaration.kind, gatewayId: declaration.id, reasons, checkedAt: now };
  };

  const authority = authorityRegistry.get(declaration.issuer);
  if (!authority) return fail(`issuer '${declaration.issuer}' is not a trusted LeeWay/mesh authority`);
  if (!(await authorityRegistry.verifyGatewaySignature(declaration))) {
    return fail('gateway declaration signature invalid');
  }
  if (declaration.verification !== 'verified') {
    return fail(`gateway verification is '${declaration.verification}', not 'verified'`);
  }
  if (declaration.authorization.expiresAt <= now) return fail('gateway authorization expired');
  const capability = await verifyCapability(
    declaration.authorization.token,
    authority.publicJwk,
    context.roomId,
    requiredRight,
    now,
  );
  if (!capability.ok) return fail(capability.reason ?? 'capability verification failed');
  if (!declaration.capabilities.endToEndEncryption) return fail('gateway does not support end-to-end encryption');
  if (requiredRight === 'send' && !declaration.capabilities.bidirectional && declaration.kind !== 'physical-transfer') {
    return fail('gateway is receive-only; signed acknowledgements are impossible');
  }
  if (declaration.capabilities.linkQuality < MIN_LINK_QUALITY) {
    return fail(`link quality ${declaration.capabilities.linkQuality} below minimum ${MIN_LINK_QUALITY}`);
  }
  reasons.push('authority trusted', 'signature valid', 'authorization valid', 'room in scope',
    `right '${requiredRight}' granted`, 'E2E encryption available', 'link quality sufficient');
  return { qualified: true, route: declaration.kind, gatewayId: declaration.id, reasons, checkedAt: now };
}

export class MeshSatelliteTransport {
  private gateways = new Map<string, GatewayDeclaration>();
  private pending = new Map<string, { message: WireMessage; route: RouteKind; gatewayId: string; createdAt: number }>();
  private sink: GatewaySink;
  readonly authorities = new AuthorityRegistry();

  constructor(sink: GatewaySink) {
    this.sink = sink;
  }

  addGateway(gateway: GatewayDeclaration): void {
    this.gateways.set(gateway.id, gateway);
  }

  removeGateway(id: string): void {
    this.gateways.delete(id);
  }

  listGateways(): GatewayDeclaration[] {
    return [...this.gateways.values()];
  }

  /** Best qualified route for a room, preferring local/community mesh over internet relay. */
  async selectRoute(roomId: string, now = Date.now()): Promise<RouteQualification | null> {
    const preference: Record<RouteKind, number> = {
      'direct-webrtc': 0, 'local-lan': 1, 'community-mesh': 2, 'public-mesh-gateway': 3,
      'satellite-gateway': 4, 'physical-transfer': 5, 'internet-relay': 6,
    };
    const candidates = [...this.gateways.values()].sort(
      (a, b) => preference[a.kind] - preference[b.kind] || b.capabilities.linkQuality - a.capabilities.linkQuality,
    );
    for (const gateway of candidates) {
      const q = await qualifyGateway(gateway, this.authorities, { roomId, now }, 'send');
      if (q.qualified) return q;
    }
    return null;
  }

  /** Send a message over the best qualified route and retain it until ACK. */
  async send(params: {
    message: WireMessage;
    roomId: string;
    privateSigningKey: CryptoKey;
    selfFingerprint: string;
    now?: number;
  }): Promise<SendOutcome> {
    const route = await this.selectRoute(params.roomId, params.now);
    if (!route) {
      return { ok: false, reason: 'no qualified mesh/satellite or relay route available', acks: [] };
    }
    if (isExpired(params.message, params.now)) {
      return { ok: false, route: route.route, gatewayId: route.gatewayId, reason: 'message expired', acks: [] };
    }
    const gateway = this.gateways.get(route.gatewayId)!;
    const payloadBytes = JSON.stringify(params.message).length;
    if (payloadBytes > gateway.capabilities.maxPayloadBytes) {
      return { ok: false, route: route.route, gatewayId: route.gatewayId, reason: 'message exceeds gateway payload limit', acks: [] };
    }
    try {
      await this.sink(params.message, gateway);
    } catch (err) {
      return {
        ok: false, route: route.route, gatewayId: route.gatewayId,
        reason: `gateway transmission failed: ${String((err as Error)?.message ?? err)}`, acks: [],
      };
    }
    this.pending.set(params.message.id, {
      message: params.message, route: route.route, gatewayId: route.gatewayId, createdAt: params.now ?? Date.now(),
    });
    return { ok: true, route: route.route, gatewayId: route.gatewayId, acks: [...params.message.acknowledgements] };
  }

  /** Accept an ACK only if signed by an expected recipient over a qualified ack-capable route. */
  async acceptAck(params: {
    ack: SignedEnvelope<AckPayload>;
    recipientPublicJwk: JsonWebKey;
    expectedRecipient: string;
    now?: number;
  }): Promise<{ ok: boolean; reason?: string; message?: WireMessage }> {
    const now = params.now ?? Date.now();
    const pending = this.pending.get(params.ack.payload?.messageId);
    if (!pending) return { ok: false, reason: 'no pending message for this acknowledgement' };
    if (isExpired(pending.message, now)) {
      this.pending.delete(pending.message.id);
      return { ok: false, reason: 'message expired before acknowledgement' };
    }
    const valid = await verifyAck(params.ack, params.recipientPublicJwk, pending.message.id);
    if (!valid || params.ack.payload.recipient !== params.expectedRecipient) {
      return { ok: false, reason: 'invalid recipient acknowledgement signature' };
    }
    const gateway = this.gateways.get(pending.gatewayId);
    if (!gateway) return { ok: false, reason: 'original route gateway is gone' };
    const q = await qualifyGateway(gateway, this.authorities, { roomId: pending.message.roomId, now }, 'ack');
    if (!q.qualified) return { ok: false, reason: `ack route unqualified: ${q.reasons.join('; ')}` };
    const updated = {
      ...pending.message,
      acknowledgements: [...pending.message.acknowledgements, params.ack],
    };
    this.pending.set(updated.id, { ...pending, message: updated });
    return { ok: true, message: updated };
  }

  /** Accept an inbound message only from a qualified receive-capable route. */
  async receive(params: {
    message: WireMessage;
    roomId: string;
    senderPublicJwk: JsonWebKey;
    now?: number;
  }): Promise<ReceiveOutcome> {
    const now = params.now ?? Date.now();
    if (isExpired(params.message, now)) return { accepted: false, reason: 'message expired' };
    if (params.message.roomId !== params.roomId) return { accepted: false, reason: 'wrong room' };
    const valid = await verifyMessage(params.message, params.senderPublicJwk);
    if (!valid) return { accepted: false, reason: 'invalid message signature' };
    const route = await this.selectRoute(params.roomId, now);
    if (!route) return { accepted: false, reason: 'no qualified receive route' };
    return { accepted: true, message: params.message, route: route.route };
  }

  /** Messages still awaiting a real signed acknowledgement. */
  awaitingAcknowledgement(): WireMessage[] {
    return [...this.pending.values()].map((p) => p.message);
  }

  /** Drop expired pending entries; returns their ids for the caller to mark expired. */
  pruneExpired(now = Date.now()): string[] {
    const expired: string[] = [];
    for (const [id, p] of this.pending) {
      if (isExpired(p.message, now)) {
        this.pending.delete(id);
        expired.push(id);
      }
    }
    return expired;
  }

  status(roomId: string): LinkStatus[] {
    return this.listGateways().map((g) => ({
      route: g.kind,
      label: `${g.kind} / ${g.id}`,
      connected: g.capabilities.linkQuality >= MIN_LINK_QUALITY && g.verification === 'verified',
      detail: `${g.note ?? g.issuer} · quality ${g.capabilities.linkQuality}`,
      updatedAt: Date.now(),
    }));
  }
}

/**
 * Honest capability summary. Satellite is reported as available only when a
 * qualified satellite gateway is registered; tracking satellites in maps is
 * explicitly NOT a transmission channel.
 */
export async function networkCapabilities(
  transport: MeshSatelliteTransport,
  roomId: string,
): Promise<{ routes: string[]; satelliteTransmission: 'AVAILABLE' | 'NOT VERIFIED'; note: string }> {
  const routes = transport.listGateways().map((g) => g.kind);
  const satellite = (await Promise.all(
    transport.listGateways()
      .filter((g) => g.kind === 'satellite-gateway')
      .map((g) => qualifyGateway(g, transport.authorities, { roomId }, 'send')),
  )).some((q) => q.qualified);
  return {
    routes,
    satelliteTransmission: satellite ? 'AVAILABLE' : 'NOT VERIFIED',
    note: satellite
      ? 'A qualified, authorized satellite gateway is registered for this room.'
      : 'No authorized satellite gateway is registered. Satellite observation/tracking is not a message uplink.',
  };
}

export async function routeFingerprint(declaration: GatewayDeclaration): Promise<string> {
  return sha256(canonicalJson(gatewaySigningBody(declaration)));
}
