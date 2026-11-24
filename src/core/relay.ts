/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.RELAY
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\relay.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/relay.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/** LeeWay Global P2P — authenticated WebSocket relay/signaling client. */
import { base64ToBytes, bytesToBase64 } from './crypto.ts';
import type { WireMessage } from './types.ts';

export type RelayState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export interface RelayClientOptions {
  url: string;
  fingerprint: string;
  publicJwk: JsonWebKey;
  privateSigningKey: CryptoKey;
  roomId: string;
  circleId?: string;
  grantToken?: string;
  onState?: (state: RelayState, detail?: string) => void;
  onMessage?: (message: WireMessage, route: 'internet-relay') => void;
  onSignal?: (from: string, data: unknown) => void;
  onAck?: (from: string, ack: any) => void;
  onCircleStatus?: (status: { enforced: boolean; circleId?: string; grantId?: string }) => void;
  /** WebSocket implementation injection (browser global or `ws` in Node). */
  socketFactory?: (url: string) => WebSocket;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private state: RelayState = 'disconnected';
  private room: string;
  private circleId?: string;
  private grantToken?: string;
  private closedByUser = false;

  constructor(private options: RelayClientOptions) {
    this.room = options.roomId;
    this.circleId = options.circleId;
    this.grantToken = options.grantToken;
  }

  getState(): RelayState { return this.state; }

  private setState(state: RelayState, detail?: string) {
    this.state = state;
    this.options.onState?.(state, detail);
  }

  connect(): void {
    this.closedByUser = false;
    this.setState('connecting');
    const factory = this.options.socketFactory ?? ((url: string) => new WebSocket(url));
    try {
      this.ws = factory(this.options.url);
    } catch (err) {
      this.setState('error', String(err));
      return;
    }
    const ws = this.ws;
    ws.onopen = () => {
      this.setState('authenticating');
      this.raw({ type: 'hello', fingerprint: this.options.fingerprint, publicJwk: this.options.publicJwk });
    };
    ws.onmessage = async (event) => {
      let msg: Record<string, any>;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      switch (msg.type) {
        case 'challenge': {
          const sig = await crypto.subtle.sign(
            'Ed25519',
            this.options.privateSigningKey,
            new TextEncoder().encode(msg.nonce),
          );
          this.raw({ type: 'auth', signature: bytesToBase64(new Uint8Array(sig)) });
          break;
        }
        case 'authenticated':
          this.setState('connected');
          this.raw({ type: 'join', roomId: this.room, circleId: this.circleId, grantToken: this.grantToken });
          break;
        case 'joined':
          this.options.onState?.('connected', `room ${msg.roomId} · ${msg.peers} peer(s)`);
          break;
        case 'deliver':
          this.options.onMessage?.(msg.message as WireMessage, 'internet-relay');
          break;
        case 'signal':
          this.options.onSignal?.(msg.from, msg.data);
          break;
        case 'ack':
          this.options.onAck?.(msg.from, msg.ack);
          break;
        case 'circle-status':
          this.options.onCircleStatus?.({ enforced: !!msg.enforced, circleId: msg.circleId, grantId: msg.grantId });
          break;
        case 'published': break;
        case 'error':
          this.setState('error', `${msg.code}${msg.detail ? ': ' + msg.detail : ''}`);
          break;
        default: break;
      }
    };
    ws.onerror = () => this.setState('error', 'websocket error');
    ws.onclose = () => {
      if (!this.closedByUser) this.setState('disconnected', 'relay closed');
    };
  }

  join(roomId: string, circleId?: string, grantToken?: string): void {
    this.room = roomId;
    if (circleId) this.circleId = circleId;
    if (grantToken) this.grantToken = grantToken;
    if (this.state === 'connected') {
      this.raw({ type: 'join', roomId, circleId: this.circleId, grantToken: this.grantToken });
    }
  }

  publish(message: WireMessage): void {
    this.raw({ type: 'publish', message, circleId: this.circleId, grantToken: this.grantToken });
  }

  signal(data: unknown): void {
    this.raw({ type: 'signal', data });
  }

  sendAck(ack: unknown): void {
    this.raw({ type: 'ack', ack });
  }

  private raw(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  close(): void {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
    this.setState('disconnected');
  }
}

export { base64ToBytes };
