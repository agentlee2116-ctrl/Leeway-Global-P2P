/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.COMMS_BRIDGE
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Real authenticated relay/RTC communications bridge over canonical core contracts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/comms/bridge.ts
WHY: Replace simulated BroadcastChannel delivery with E2EE dispatch, signed ACKs and real media
HOW: Reuses core crypto/messages/storage/relay/rtc; BroadcastChannel remains local-tab sync only
*/
import {
  decryptDispatchBody, encryptForRecipients,
} from '../core/crypto.ts';
import {
  addAck, createAck, createMessage, deliveryMatrix, isFullyAcknowledged, verifyAck, verifyMessage,
} from '../core/messages.ts';
import { IndexedDbMessageStore, newQueued } from '../core/storage.ts';
import type { QueuedMessage } from '../core/types.ts';
import { RelayClient, type RelayState } from '../core/relay.ts';
import { P2PLink, detectMediaCapabilities, type SignalPayload } from '../core/rtc.ts';
import type { MessageKind, SignedEnvelope, AckPayload, WireMessage, MediaMetadata } from '../core/types.ts';
import type {
  CircleAuthorityState, CircleMemberRecord, DeviceKeyRecord, SignedMembershipGrant,
} from '../utils/enrollmentCrypto.ts';
import {
  receiveRelaySyncEvent, setRelaySyncTransport, type RelaySyncMessage,
} from '../utils/circleStore.ts';

export interface DispatchPayload {
  kind: MessageKind;
  text?: string;
  name?: string;
  mediaBase64?: string;
  mime?: string;
  durationMs?: number;
  meta?: MediaMetadata;
}

export interface BridgeCallbacks {
  onDispatch: (payload: DispatchPayload, senderFingerprint: string, messageId: string) => void;
  onAck: (messageId: string, acked: number, total: number) => void;
  onState: (state: RelayState | 'offline', detail: string) => void;
}

/* No implicit localhost: on a phone that points at the phone itself. A relay
 * must be configured explicitly, otherwise dispatches remain queued offline. */
const DEFAULT_RELAY = '';

export class SecureCommsBridge {
  readonly store = new IndexedDbMessageStore();
  private relay: RelayClient | null = null;
  private link: P2PLink | null = null;
  private relayState: RelayState | 'offline' = 'offline';
  private queued = new Map<string, QueuedMessage>();

  constructor(
    private params: {
      circleId: string;
      authority: CircleAuthorityState;
      grant: SignedMembershipGrant;
      deviceKeys: DeviceKeyRecord;
      relayUrl?: string;
    },
    private callbacks: BridgeCallbacks,
  ) {}

  private get recipients() {
    const revoked = new Set(this.params.authority.revokedDeviceIds ?? []);
    return this.params.authority.members
      .filter((m: CircleMemberRecord) => !m.revoked && !revoked.has(m.deviceId) && !!m.ecdhPubJwk)
      .map((m: CircleMemberRecord) => ({ fingerprint: m.fingerprint, agreement: m.ecdhPubJwk }));
  }

  private memberByFingerprint(fingerprint: string): CircleMemberRecord | undefined {
    return this.params.authority.members.find((m) => m.fingerprint === fingerprint);
  }

  connect(): void {
    const url = this.params.relayUrl || localStorage.getItem('lwp.relayUrl') || DEFAULT_RELAY;
    if (!url) {
      this.relayState = 'offline';
      this.callbacks.onState('offline', 'No relay configured — encrypted dispatches queue locally');
      return;
    }
    this.relay?.close();
    const relay = new RelayClient({
      url,
      fingerprint: this.params.deviceKeys.fingerprint,
      publicJwk: this.params.deviceKeys.signPubJwk,
      privateSigningKey: this.params.deviceKeys.signKeyPair.privateKey,
      roomId: `leeway-${this.params.circleId}`,
      circleId: this.params.circleId,
      grantToken: undefined,
      onState: (state, detail) => {
        this.relayState = state;
        this.callbacks.onState(state, detail ?? '');
        if (state === 'connected') void this.flushQueue();
      },
      onMessage: (message) => { void this.receive(message); },
      onAck: (_from, ack) => { void this.receiveAck(ack); },
      onSignal: (from, data: any) => {
        if (data?.to && data.to !== this.params.deviceKeys.fingerprint) return;
        if (typeof data?.type === 'string' && /^(JOIN_REQUEST|MEMBERSHIP_GRANT|REVOCATION_LIST|ENCRYPTED_DISPATCH)$/.test(data.type)) {
          receiveRelaySyncEvent(data as RelaySyncMessage);
          return;
        }
        void this.link?.handleSignal(data as SignalPayload);
      },
    });
    this.relay = relay;
    setRelaySyncTransport((message) => relay.signal(message));
    relay.connect();
  }

  getState(): RelayState | 'offline' { return this.relayState; }

  async send(payload: DispatchPayload): Promise<{ id: string; sent: boolean }> {
    const body = await encryptForRecipients({
      plaintext: JSON.stringify(payload),
      recipients: this.recipients,
      senderFingerprint: this.params.deviceKeys.fingerprint,
      meta: payload.meta,
    });
    const message = await createMessage({
      roomId: `leeway-${this.params.circleId}`,
      circleId: this.params.circleId,
      kind: payload.kind,
      from: this.params.deviceKeys.fingerprint,
      recipients: this.recipients.map((r) => r.fingerprint),
      body,
      privateSigningKey: this.params.deviceKeys.signKeyPair.privateKey,
      senderPublicJwk: this.params.deviceKeys.signPubJwk,
    });
    const item = newQueued(message);
    this.queued.set(message.id, item);
    await this.store.put(item);
    const sent = this.relay?.getState() === 'connected' || this.link?.connected === true;
    if (sent) this.publish(message, item);
    return { id: message.id, sent };
  }

  private publish(message: WireMessage, item: QueuedMessage): void {
    if (this.relay?.getState() === 'connected') this.relay.publish(message);
    if (this.link?.connected) this.link.send(message);
    void this.store.put({ ...item, status: 'sent', attempts: item.attempts + 1, lastAttemptAt: Date.now() });
  }

  private async flushQueue(): Promise<void> {
    for (const item of await this.store.all()) {
      if (item.status === 'queued') this.publish(item.message, item);
    }
  }

  private async receive(message: WireMessage): Promise<void> {
    const member = this.memberByFingerprint(message.from);
    if (!member) { this.callbacks.onState(this.relayState, 'dispatch from unknown member ignored'); return; }
    if (!(await verifyMessage(message, member.signPubJwk))) {
      this.callbacks.onState(this.relayState, 'invalid dispatch signature ignored');
      return;
    }
    try {
      const { plaintext } = await decryptDispatchBody({
        body: message.body as string,
        selfFingerprint: this.params.deviceKeys.fingerprint,
        selfAgreementPrivate: this.params.deviceKeys.ecdhKeyPair.privateKey,
        senderFingerprint: message.from,
      });
      const payload = JSON.parse(plaintext) as DispatchPayload;
      this.callbacks.onDispatch(payload, message.from, message.id);
      const ack = await createAck(
        message, this.params.deviceKeys.fingerprint, 'internet-relay',
        this.params.deviceKeys.signKeyPair.privateKey,
      );
      this.relay?.sendAck(ack);
      await this.store.put({ message, attempts: 0, status: 'delivered', route: 'internet-relay' });
    } catch (err) {
      this.callbacks.onState(this.relayState, `dispatch decrypt failed: ${String(err)}`);
    }
  }

  private async receiveAck(ack: SignedEnvelope<AckPayload>): Promise<void> {
    const member = this.memberByFingerprint(ack.payload?.recipient);
    if (!member || !(await verifyAck(ack, member.signPubJwk, ack.payload.messageId))) return;
    const item = await this.store.get(ack.payload.messageId);
    if (!item) return;
    const message = addAck(item.message, ack);
    const matrix = deliveryMatrix(message, this.recipients);
    const acked = matrix.filter((r) => r.acked).length;
    await this.store.put({
      ...item, message,
      status: isFullyAcknowledged(message) ? 'delivered' : 'sent',
    });
    this.callbacks.onAck(message.id, acked, matrix.length);
  }

  /** Opt-in live video room: real WebRTC media over relay signaling. */
  async openPrivateRoom(): Promise<boolean> {
    if (this.relay?.getState() !== 'connected') return false;
    for (const peer of this.memberByFingerprintAny()) {
      if (this.link) break;
      const initiator = this.params.deviceKeys.fingerprint < peer.fingerprint;
      const link = new P2PLink(
        this.params.deviceKeys.fingerprint, peer.fingerprint,
        (to, payload) => this.relay?.signal({ to, ...payload }),
        (m) => { void this.receive(m); },
        (state) => this.callbacks.onState(this.relayState, `RTC ${state}`),
      );
      this.link = link;
      await link.start(initiator);
    }
    return !!this.link;
  }

  private memberByFingerprintAny(): CircleMemberRecord[] {
    return this.params.authority.members.filter(
      (m) => m.fingerprint !== this.params.deviceKeys.fingerprint && !m.revoked,
    );
  }

  async startLiveMedia(withVideo: boolean): Promise<void> {
    if (!this.link) await this.openPrivateRoom();
    if (!this.link) throw new Error('No live peer path available');
    if (withVideo) await this.link.startCall(true);
    else await this.link.startVoice('ptt');
  }

  closePrivateRoom(): void {
    this.link?.close();
    this.link = null;
  }

  mediaCapabilities() { return detectMediaCapabilities(); }

  close(): void {
    this.closePrivateRoom();
    this.relay?.close();
    this.relay = null;
  }
}
