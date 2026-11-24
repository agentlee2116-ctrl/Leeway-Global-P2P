/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.APP_UI
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P product engineering
WHAT: Walkie-talkie dispatch UI with multilingual surface, media bursts, multi-peer rooms and opt-in video room
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/App.tsx
WHY: Family members across regions need an offline-first, private dispatch network with their own language and logo
HOW: React/Capacitor UI over LeeWay crypto, transport and relay contracts; no competing authority and no fabricated connectivity
*/
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectPlatform, OrderedPlaybackQueue, type CaptureHandle } from './platform/index.ts';
import QRCode from 'qrcode';
import {
  base64ToBytes, bytesToBase64, decryptDispatchBody, encryptForRecipients,
  generateIdentity, sha256,
} from './core/crypto.ts';
import {
  ackCountFor, addAck, createAck, createMessage, deliveryMatrix, isFullyAcknowledged,
  mediaMetadata, verifyAck, verifyMessage,
} from './core/messages.ts';
import { MeshSatelliteTransport, declareGateway, networkCapabilities } from './core/transport.ts';
import {
  IndexedDbMessageStore, buildTransferBundle, expireStale, newQueued,
  parseTransferBundle, type MessageStore,
} from './core/storage.ts';
import { decryptAttachment, encryptAttachment } from './core/files.ts';
import { createInviteLink, DELIVERY_TIERS, parseInvite } from './core/invite.ts';
import { issueServiceGrant, SIX_MONTHS_MS, ONE_YEAR_MS, validateCircleAccess, type ServiceGrant } from './core/circles.ts';
import { isUpdateActionable, registerPwaUpdates, type PwaUpdateHandle, type UpdateState } from './pwa-updates.ts';
import { RelayClient, type RelayState } from './core/relay.ts';
import { P2PLink, detectMediaCapabilities, type SignalPayload } from './core/rtc.ts';
import { LANGUAGES, translator, translationCoverage, type TranslationKey } from './i18n.ts';
import type {
  AckPayload, Attachment, GatewayDeclaration, IdentityPrivate, IdentityPublic,
  MediaMetadata, MessageKind, PairingInvitation, PeerRecord, QueuedMessage,
  SignedEnvelope, WireMessage,
} from './core/types.ts';

type Tab = 'dispatch' | 'media' | 'room' | 'network' | 'setup';
type MediaView = { url: string; mime: string; kind: string; name: string };

interface Session {
  transport: MeshSatelliteTransport | null;
  relay: RelayClient | null;
  links: Map<string, P2PLink>;
  identity: IdentityPrivate | null;
  peers: PeerRecord[];
  room: string;
  store: MessageStore;
  recorder: MediaRecorder | null;
  chunks: BlobPart[];
}

async function loadStoredIdentity(): Promise<IdentityPrivate | null> {
  const raw = localStorage.getItem('lwp.identity');
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    const signing = await crypto.subtle.importKey('jwk', s.signingPrivate, { name: 'Ed25519' }, true, ['sign']);
    const agreement = await crypto.subtle.importKey('jwk', s.agreementPrivate, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    return { signing, agreement, public: s.public as IdentityPublic };
  } catch { return null; }
}

async function persistIdentity(id: IdentityPrivate): Promise<void> {
  await Promise.all([
    crypto.subtle.exportKey('jwk', id.signing).then((k) => localStorage.setItem('lwp.signing', JSON.stringify(k))),
    crypto.subtle.exportKey('jwk', id.agreement).then((k) => localStorage.setItem('lwp.agreement', JSON.stringify(k))),
  ]);
  localStorage.setItem('lwp.identity', JSON.stringify({
    signingPrivate: await crypto.subtle.exportKey('jwk', id.signing),
    agreementPrivate: await crypto.subtle.exportKey('jwk', id.agreement),
    public: id.public,
  }));
}

interface LocalAuthority { privateJwk: JsonWebKey; publicJwk: JsonWebKey; fingerprint: string }
async function ensureLocalAuthority(): Promise<LocalAuthority> {
  const raw = localStorage.getItem('lwp.localAuthority');
  if (raw) return JSON.parse(raw) as LocalAuthority;
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(publicJwk)));
  const record = { privateJwk, publicJwk, fingerprint: bytesToBase64(new Uint8Array(digest)) };
  localStorage.setItem('lwp.localAuthority', JSON.stringify(record));
  return record;
}

function download(name: string, content: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dispatch');
  const [locale, setLocale] = useState(() => localStorage.getItem('lwp.locale') || 'en');
  const t = useCallback((key: TranslationKey) => translator(locale)(key), [locale]);
  const coverage = translationCoverage(locale);

  const [identity, setIdentity] = useState<IdentityPrivate | null>(null);
  const [displayName, setDisplayName] = useState('LeeWay User');
  const [roomId, setRoomId] = useState('leeway-family');
  const [relayUrl, setRelayUrl] = useState('ws://localhost:8787');
  const [peers, setPeers] = useState<PeerRecord[]>([]);
  const [peerInput, setPeerInput] = useState('');
  const [relayState, setRelayState] = useState<RelayState>('disconnected');
  const [relayDetail, setRelayDetail] = useState('');
  const [messages, setMessages] = useState<QueuedMessage[]>([]);
  const [plaintext, setPlaintext] = useState<Record<string, string>>({});
  const [mediaViews, setMediaViews] = useState<Record<string, MediaView>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [gateways, setGateways] = useState<GatewayDeclaration[]>([]);
  const [gatewayInput, setGatewayInput] = useState('');
  const [authorityInput, setAuthorityInput] = useState('');
  const [routeInfo, setRouteInfo] = useState('No gateway registered');
  const [satelliteStatus, setSatelliteStatus] = useState('NOT VERIFIED');
  const [invitationQr, setInvitationQr] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [recording, setRecording] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [outgoingBundle, setOutgoingBundle] = useState<string>('');
  const [incomingBundle, setIncomingBundle] = useState<{ name: string; mime: string; bytes: Uint8Array } | null>(null);
  const [roomActive, setRoomActive] = useState(false);
  const [circleId, setCircleId] = useState('');
  const [circleStatus, setCircleStatus] = useState('No circle configured');
  const [grant, setGrant] = useState<ServiceGrant | null>(null);
  const [grantInput, setGrantInput] = useState('');
  const [serviceWindow, setServiceWindow] = useState<'6m' | '1y'>('6m');
  const [updateState, setUpdateState] = useState<UpdateState>('unavailable');

  const platform = useMemo(() => detectPlatform(), []);
  const platformCaps = useMemo(() => platform.capabilities(), [platform]);
  const playback = useMemo(() => new OrderedPlaybackQueue(async (id) => {
    const view = mediaViewsRef.current[id];
    setPlayingId(id);
    if (view) await platform.playBurst(view.url, view.mime);
    setPlayingId(null);
  }), [platform]);
  const mediaViewsRef = useRef<Record<string, MediaView>>({});
  const captureRef = useRef<CaptureHandle | null>(null);
  const updateHandle = useRef<PwaUpdateHandle | null>(null);

  const session = useRef<Session>({
    transport: null, relay: null, links: new Map(), identity: null, peers: [],
    room: 'leeway-family', store: platform.storage(), recorder: null, chunks: [],
  });

  const addLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toISOString().slice(11, 19)} ${line}`, ...prev].slice(0, 150));
  }, []);

  useEffect(() => { localStorage.setItem('lwp.locale', locale); }, [locale]);
  useEffect(() => { loadStoredIdentity().then(setIdentity); }, []);
  useEffect(() => {
    let cancelled = false;
    registerPwaUpdates((state) => { if (!cancelled) setUpdateState(state); })
      .then((handle) => { if (!cancelled) updateHandle.current = handle; });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { session.current.identity = identity; }, [identity]);
  useEffect(() => { session.current.peers = peers; }, [peers]);
  useEffect(() => { session.current.room = roomId; }, [roomId]);
  useEffect(() => { session.current.store.all().then((items) => setMessages(expireStale(items))).catch(() => {}); }, []);

  // Mesh/satellite adapter: routes only qualify when a trusted authority signs them.
  useEffect(() => {
    const transport = new MeshSatelliteTransport(async (message, gateway) => {
      const endpoint = gateway.endpoint ?? '';
      if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gatewayId: gateway.id, message }),
        });
        if (!res.ok) throw new Error(`gateway HTTP ${res.status}`);
      } else {
        addLog(`${gateway.id}: ${gateway.note ?? 'no external driver'} (no external transmission)`);
      }
    });
    session.current.transport = transport;
    ensureLocalAuthority().then((a) => {
      transport.authorities.add({
        id: 'local-demo-authority', label: 'LOCAL DEMO AUTHORITY', publicJwk: a.publicJwk,
        source: 'local-demo', trustedAt: Date.now(),
      });
    });
    return () => { session.current.transport = null; };
  }, [addLog]);

  const refreshNetwork = useCallback(async () => {
    const transport = session.current.transport;
    if (!transport) return;
    const route = await transport.selectRoute(session.current.room);
    const caps = await networkCapabilities(transport, session.current.room);
    setRouteInfo(route ? `${route.route} via ${route.gatewayId}` : t('noRoute'));
    setSatelliteStatus(caps.satelliteTransmission === 'AVAILABLE' ? t('available') : t('notVerified'));
    setGateways([...transport.listGateways()]);
  }, [t]);

  useEffect(() => { void refreshNetwork(); }, [refreshNetwork, roomId]);

  const upsert = useCallback(async (item: QueuedMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((i) => i.message.id === item.message.id);
      const next = idx >= 0 ? prev.map((i, n) => (n === idx ? item : i)) : [...prev, item];
      return next.sort((a, b) => a.message.createdAt - b.message.createdAt);
    });
    try { await session.current.store.put(item); } catch { /* store optional */ }
  }, []);

  const dispatch = useCallback(async (message: WireMessage) => {
    const s = session.current;
    if (!s.identity) return;
    let sent = false;
    let usedRoute = '';
    for (const link of s.links.values()) {
      if (link.connected && link.send(message)) { sent = true; usedRoute = 'direct-webrtc'; break; }
    }
    if (!sent && s.transport) {
      const result = await s.transport.send({
        message, roomId: s.room, privateSigningKey: s.identity.signing,
        selfFingerprint: s.identity.public.fingerprint,
      });
      sent = result.ok;
      usedRoute = result.ok ? `${result.route}/${result.gatewayId}` : '';
      if (result.reason) addLog(`mesh route: ${result.reason}`);
    }
    if (!sent && s.relay?.getState() === 'connected') {
      s.relay.publish(message); sent = true; usedRoute = 'internet-relay';
    }
    await upsert({
      message, attempts: 1, status: sent ? 'sent' : 'queued',
      route: (usedRoute || undefined) as QueuedMessage['route'],
      lastAttemptAt: Date.now(), error: sent ? undefined : t('offlineNote'),
    });
    addLog(`${sent ? 'sent' : 'queued'} ${message.kind} ${usedRoute}`);
  }, [addLog, t, upsert]);

  useEffect(() => { mediaViewsRef.current = mediaViews; }, [mediaViews]);

  // Ordered PTT playback is a platform capability, not an OS-specific code path.
  useEffect(() => {
    if (playingId || playback.current || playback.pending.length === 0) return;
    void playback.advance();
  }, [mediaViews, playingId, playback]);

  const handleDeliver = useCallback(async (message: WireMessage) => {
    const s = session.current;
    if (!s.identity || message.roomId !== s.room) return;
    const sender = s.peers.find((p) => p.fingerprint === message.from);
    if (!sender) { addLog(`unknown peer ${message.from.slice(0, 12)} — dispatch ignored`); return; }
    if (!(await verifyMessage(message, sender.signing))) { addLog('rejected invalid signature'); return; }
    try {
      const { plaintext: plain, meta } = await decryptDispatchBody({
        body: message.body as string, selfFingerprint: s.identity.public.fingerprint,
        selfAgreementPrivate: s.identity.agreement, senderFingerprint: message.from,
      });
      setPlaintext((p) => ({ ...p, [message.id]: meta ? (meta.name ?? `[${meta.media}]`) : plain }));
      if (meta?.media === 'audio' || meta?.media === 'photo' || meta?.media === 'video') {
        const bytes = base64ToBytes(plain);
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: meta.mime }));
        setMediaViews((m) => ({ ...m, [message.id]: { url, mime: meta.mime, kind: meta.media, name: meta.name } }));
        if (meta.media === 'audio') playback.enqueue(message.id);
      }
    } catch (err) { addLog(`decrypt failed: ${String(err)}`); return; }
    await upsert({ message, attempts: 0, status: 'delivered', route: 'internet-relay' });
    const ack = await createAck(message, s.identity.public.fingerprint, 'internet-relay', s.identity.signing);
    s.relay?.sendAck(ack);
    addLog(`dispatch received, signed ACK sent to ${sender.displayName}`);
  }, [addLog, playback, upsert]);

  const handleAck = useCallback(async (ack: SignedEnvelope<AckPayload>) => {
    const s = session.current;
    const sender = s.peers.find((p) => p.fingerprint === ack.payload?.recipient);
    if (!sender) return;
    if (!(await verifyAck(ack, sender.signing, ack.payload.messageId))) { addLog('rejected invalid ACK'); return; }
    const item = await s.store.get(ack.payload.messageId);
    if (!item) return;
    const updated = { ...item, message: addAck(item.message, ack) };
    if (s.transport) {
      const res = await s.transport.acceptAck({
        ack, recipientPublicJwk: sender.signing, expectedRecipient: sender.fingerprint,
      });
      if (!res.ok) addLog(`ack route: ${res.reason}`);
    }
    await upsert({ ...updated, status: isFullyAcknowledged(updated.message) ? 'delivered' : 'queued' });
    addLog(`per-recipient confirmation from ${sender.displayName} (${ackCountFor(updated.message)}/${(updated.message.recipients ?? []).length})`);
  }, [addLog, upsert]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const s = session.current;
      const expired = expireStale(await s.store.all());
      for (const i of expired) if (i.status === 'expired') await s.store.put(i);
      setMessages(expired);
      for (const item of expired.filter((i) => i.status === 'queued')) await dispatch(item.message);
      s.transport?.pruneExpired();
    }, 15000);
    return () => clearInterval(timer);
  }, [dispatch]);

  async function createIdentity() {
    const id = await generateIdentity(displayName.trim() || 'LeeWay User');
    await persistIdentity(id);
    setIdentity(id);
    setRoomId(`room-${id.public.fingerprint.slice(0, 8)}`);
    addLog(`identity ${id.public.fingerprint.slice(0, 16)}`);
  }

  async function makeInvitation() {
    if (!identity) return;
    const inv: PairingInvitation = {
      v: 1, displayName: identity.public.displayName, fingerprint: identity.public.fingerprint,
      roomId, relayUrl: relayUrl.trim() || undefined, createdAt: Date.now(),
    };
    setInvitationQr(await QRCode.toDataURL(JSON.stringify(inv), { width: 320, margin: 1 }));
    setInviteLink(createInviteLink(window.location.origin + window.location.pathname, inv));
    download('leeway-invitation.json', JSON.stringify(inv, null, 2));
  }

  function importPeer() {
    try {
      const parsed = parseInvite(peerInput) ?? JSON.parse(peerInput);
      const id: IdentityPublic = parsed.signing && parsed.agreement ? parsed : {
        signing: parsed.public?.signing, agreement: parsed.public?.agreement,
        fingerprint: parsed.fingerprint, displayName: parsed.displayName,
      };
      if (!id.fingerprint || !id.signing || !id.agreement) throw new Error('incomplete identity');
      const record: PeerRecord = {
        ...id, addedAt: Date.now(), displayName: id.displayName || 'Family member',
        region: parsed.region,
      };
      setPeers((prev) => prev.some((p) => p.fingerprint === id.fingerprint) ? prev : [...prev, record]);
      if (parsed.roomId) setRoomId(parsed.roomId);
      if (parsed.relayUrl) setRelayUrl(parsed.relayUrl);
      setPeerInput('');
      addLog(`member added: ${record.displayName}`);
    } catch (err) { addLog(`pairing failed: ${String(err)}`); }
  }

  async function makeDemoGrant() {
    const s = session.current;
    if (!s.identity) { addLog('create an identity first'); return; }
    const authority = await ensureLocalAuthority();
    const key = await crypto.subtle.importKey('jwk', authority.privateJwk, { name: 'Ed25519' }, true, ['sign']);
    const id = circleId.trim() || `circle-${s.identity.public.fingerprint.slice(0, 8)}`;
    const g = await issueServiceGrant({
      circleId: id, scope: 'relay', rights: ['join', 'send', 'receive', 'ack'],
      fingerprint: s.identity.public.fingerprint, issuerPrivateKey: key,
      issuerFingerprint: authority.fingerprint,
      windowMs: serviceWindow === '6m' ? SIX_MONTHS_MS : ONE_YEAR_MS,
    });
    setCircleId(id);
    setGrant(g);
    setCircleStatus(`demo grant active (${serviceWindow === '6m' ? '6 months' : '1 year'}, local authority)`);
    addLog(`circle ${id}: demo service grant issued`);
  }

  async function connectRelay() {
    const s = session.current;
    s.relay?.close();
    if (!s.identity) { addLog('create an identity first'); return; }
    if (circleId && grant) {
      const authority = await ensureLocalAuthority();
      const check = await validateCircleAccess({
        circle: { circleId, name: 'Local family circle', createdAt: Date.now(), members: [s.identity.public.fingerprint], issuer: 'local-demo-authority' },
        grant, issuerPublicJwk: authority.publicJwk, requiredRight: 'join', requiredScope: 'relay',
      });
      setCircleStatus(check.ok ? `active · ${grant.payload.scope}` : `${check.reason} · ${check.status ?? 'revoked'}`);
      if (!check.ok) { addLog(`circle grant rejected: ${check.reason}`); return; }
    }
    const client = new RelayClient({
      url: relayUrl.trim(), fingerprint: s.identity.public.fingerprint,
      publicJwk: s.identity.public.signing, privateSigningKey: s.identity.signing, roomId,
      circleId: circleId || undefined, grantToken: grant?.token,
      onCircleStatus: (status) => setCircleStatus(status.enforced
        ? `${status.circleId ?? 'circle'} · service grant verified by relay`
        : 'relay open mode (no circle authority configured)'),
      onState: (state, detail) => { setRelayState(state); setRelayDetail(detail ?? ''); addLog(`relay: ${state}`); },
      onMessage: (m) => { void handleDeliver(m); },
      onAck: (_from, ack) => { void handleAck(ack); },
      onSignal: (from, data: any) => {
        if (data?.to && data.to !== s.identity?.public.fingerprint) return;
        void s.links.get(from)?.handleSignal(data as SignalPayload);
      },
    });
    s.relay = client;
    client.connect();
  }

  async function openPrivateRoom() {
    const s = session.current;
    if (!s.identity || peers.length === 0) { addLog('add at least one member before opening the room'); return; }
    if (s.relay?.getState() !== 'connected') { addLog('relay must be connected for private room signaling'); return; }
    for (const peer of peers) {
      if (s.links.has(peer.fingerprint)) continue;
      const initiator = s.identity.public.fingerprint < peer.fingerprint;
      const link = new P2PLink(
        s.identity.public.fingerprint, peer.fingerprint,
        (to, payload) => s.relay?.signal({ to, ...payload }),
        (m) => { void handleDeliver(m); },
        () => {}, (line) => addLog(line),
      );
      s.links.set(peer.fingerprint, link);
      await link.start(initiator);
    }
    setRoomActive(true);
    addLog('private video room opened (opt-in live mode)');
  }

  function leaveRoom() {
    session.current.links.forEach((l) => l.close());
    session.current.links.clear();
    setRoomActive(false);
    addLog('private video room closed — dispatch mode resumed');
  }

  async function startLiveMedia(withVideo: boolean) {
    const s = session.current;
    if (s.links.size === 0) await openPrivateRoom();
    const first = [...s.links.values()][0];
    if (!first) return;
    try {
      if (withVideo) await first.startCall(true);
      else await first.startVoice('ptt');
      addLog(withVideo ? 'live video started' : 'live voice started');
    } catch (err) { addLog(`media failed: ${String(err)}`); }
  }

  async function sendText() {
    const s = session.current;
    const text = input.trim();
    if (!text || !s.identity || peers.length === 0) return;
    const body = await encryptForRecipients({
      plaintext: text, recipients: peers, senderFingerprint: s.identity.public.fingerprint,
    });
    const message = await createMessage({
      roomId, circleId: circleId || undefined, kind: 'text', from: s.identity.public.fingerprint,
      to: undefined, recipients: peers.map((p) => p.fingerprint),
      body, privateSigningKey: s.identity.signing,
      senderPublicJwk: s.identity.public.signing,
    });
    setPlaintext((p) => ({ ...p, [message.id]: text }));
    setInput('');
    await dispatch(message);
  }

  /** Encrypts a self-contained media burst for every room member. */
  async function sendBurst(file: {
    name: string; mime: string; bytes: Uint8Array; durationMs?: number;
  }, kind: MessageKind, previewUrl?: string) {
    const s = session.current;
    if (!s.identity || peers.length === 0) return;
    const media: MediaMetadata['media'] = kind === 'ptt' ? 'audio'
      : file.mime.startsWith('video/') ? 'video'
      : file.mime.startsWith('image/') ? 'photo' : 'file';
    const meta: MediaMetadata = {
      media, mime: file.mime, name: file.name, size: file.bytes.length,
      sha256: await sha256(file.bytes), durationMs: file.durationMs, ptt: kind === 'ptt',
    };
    const body = await encryptForRecipients({
      plaintext: bytesToBase64(file.bytes), recipients: peers,
      senderFingerprint: s.identity.public.fingerprint, meta,
    });
    const message = await createMessage({
      roomId, circleId: circleId || undefined, kind, from: s.identity.public.fingerprint, to: undefined,
      recipients: peers.map((p) => p.fingerprint), body,
      privateSigningKey: s.identity.signing, senderPublicJwk: s.identity.public.signing,
    });
    setPlaintext((p) => ({ ...p, [message.id]: file.name }));
    if (previewUrl && (media === 'video' || media === 'photo')) {
      setMediaViews((m) => ({ ...m, [message.id]: { url: previewUrl, mime: file.mime, kind: media, name: file.name } }));
    }
    await dispatch(message);
    addLog(`encrypted ${media} burst ${file.name} (${file.bytes.length} bytes)`);
  }

  async function togglePtt() {
    if (recording && captureRef.current) { captureRef.current.stop(); setRecording(false); return; }
    try {
      const handle = await platform.captureAudio();
      captureRef.current = handle;
      setRecording(true);
      addLog('recording voice burst…');
      void handle.result.then(async (burst) => {
        captureRef.current = null;
        setRecording(false);
        if (!burst.bytes.length) return;
        await sendBurst({
          name: `ptt-${Date.now()}.${burst.mime.includes('mp4') ? 'm4a' : 'webm'}`,
          mime: burst.mime, bytes: burst.bytes, durationMs: burst.durationMs,
        }, 'ptt');
      }).catch((err) => { captureRef.current = null; setRecording(false); addLog(`audio failed: ${String(err)}`); });
    } catch (err) { addLog(`microphone denied: ${String(err)}`); }
  }

  async function toggleVideoSnap() {
    if (videoRecording && captureRef.current) { captureRef.current.stop(); setVideoRecording(false); return; }
    try {
      const handle = await platform.captureVideo();
      captureRef.current = handle;
      setVideoRecording(true);
      addLog('recording video snap…');
      void handle.result.then(async (burst) => {
        captureRef.current = null;
        setVideoRecording(false);
        if (!burst.bytes.length) return;
        await sendBurst({
          name: `snap-${Date.now()}.${burst.mime.includes('mp4') ? 'mp4' : 'webm'}`,
          mime: burst.mime, bytes: burst.bytes, durationMs: burst.durationMs,
        }, 'snap', burst.previewUrl);
      }).catch((err) => { captureRef.current = null; setVideoRecording(false); addLog(`camera failed: ${String(err)}`); });
    } catch (err) { addLog(`camera denied: ${String(err)}`); }
  }

  async function onFilePicked(kind: 'snap' | 'file', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const previewUrl = file.type.startsWith('video/') || file.type.startsWith('image/')
      ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: file.type })) : undefined;
    await sendBurst({ name: file.name, mime: file.type || 'application/octet-stream', bytes }, kind, previewUrl);
  }

  async function exportBundle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const s = session.current;
    if (!file || !s.identity || peers.length === 0) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const attachment = await encryptAttachment({
      file: { name: file.name, type: file.type, size: bytes.length, bytes },
      recipientAgreementJwk: peers[0].agreement,
      senderFingerprint: s.identity.public.fingerprint,
    });
    const message = await createMessage({
      roomId, circleId: circleId || undefined, kind: 'file', from: s.identity.public.fingerprint, to: peers[0].fingerprint,
      body: bytesToBase64(new TextEncoder().encode(JSON.stringify({
        name: file.name, mime: file.type, sha256: attachment.sha256, media: 'file',
      }))),
      privateSigningKey: s.identity.signing, senderPublicJwk: s.identity.public.signing,
    });
    setOutgoingBundle(buildTransferBundle(message, attachment, s.identity.public.fingerprint));
    addLog(`offline bundle ready for ${file.name}`);
  }

  async function importBundle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const s = session.current;
    if (!file || !s.identity || peers.length === 0) return;
    try {
      const bundle = parseTransferBundle(await file.text());
      const sender = peers.find((p) => p.fingerprint === bundle.message.from);
      if (!sender || !(await verifyMessage(bundle.message, sender.signing))) throw new Error('invalid sender signature');
      const bytes = await decryptAttachment(bundle.attachment, s.identity.agreement, bundle.message.from);
      setIncomingBundle({ name: bundle.attachment.name, mime: bundle.attachment.mime, bytes });
      await upsert({ message: bundle.message, attempts: 0, status: 'delivered', route: 'physical-transfer' });
      addLog(`offline bundle received: ${bundle.attachment.name}`);
    } catch (err) { addLog(`bundle rejected: ${String(err)}`); }
  }

  async function addDemoGateway() {
    const s = session.current;
    const authority = await ensureLocalAuthority();
    const key = await crypto.subtle.importKey('jwk', authority.privateJwk, { name: 'Ed25519' }, true, ['sign']);
    const declaration = await declareGateway({
      id: `local-loopback-${Date.now().toString(36)}`, kind: 'local-lan',
      issuer: 'local-demo-authority', scope: [roomId], rights: ['send', 'receive', 'ack'],
      verification: 'verified', linkQuality: 0.9, endpoint: 'loopback://local-demo',
      note: 'SOFTWARE LOOPBACK — no physical radio, not a satellite uplink.',
      issuerPrivateKey: key,
    });
    s.transport?.addGateway(declaration);
    await refreshNetwork();
    addLog('local demo gateway added (software only)');
  }

  const caps = detectMediaCapabilities();
  const queuedCount = messages.filter((m) => m.status === 'queued').length;

  const nav: Array<[Tab, TranslationKey]> = [
    ['dispatch', 'dispatch'], ['media', 'media'], ['room', 'room'], ['network', 'network'], ['setup', 'setup'],
  ];

  return (
    <div className="app" dir={locale.startsWith('ar') || locale.startsWith('fa') || locale.startsWith('he') || locale.startsWith('ur') ? 'rtl' : 'ltr'}>
      <header>
        <div className="brand-row">
          <img className="brand-logo" src="./leeway-logo-small.png" alt={t('appName')} />
          <div>
            <div className="brand">{t('appName')}</div>
            <div className="sub">{t('tagline')}</div>
          </div>
        </div>
        <div className="language-row">
          <label htmlFor="lang">{t('language')}:</label>
          <select id="lang" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          {coverage < 100 && <span className="muted" title={t('partTranslation')}>{coverage}%</span>}
        </div>
      </header>

      {isUpdateActionable(updateState, typeof navigator === 'undefined' ? false : navigator.onLine) && (
        <div className="update-banner">
          <span>New LeeWay P2P version available. Your queued encrypted dispatches are stored locally and will be preserved.</span>
          <button onClick={() => void updateHandle.current?.applyUpdate()}>Refresh now</button>
        </div>
      )}

      <nav>
        {nav.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{t(label)}</button>
        ))}
      </nav>

      <main>
        {tab === 'dispatch' && (
          <section>
            <div className="card status-card">
              <div><span className="label">{t('identity')}</span><span className="value">{identity ? identity.public.fingerprint.slice(0, 18) : t('notCreated')}</span></div>
              <div><span className="label">{t('roomLabel')}</span><span className="value">{roomId}</span></div>
              <div><span className="label">{t('relay')}</span><span className="value">{relayState}</span></div>
              <div><span className="label">{t('route')}</span><span className="value">{routeInfo}</span></div>
              <div><span className="label">{t('satellite')}</span><span className="value warn">{satelliteStatus}</span></div>
              <div><span className="label">{t('queued')}</span><span className="value">{queuedCount}</span></div>
            </div>

            <div className="card message-list">
              {messages.length === 0 && <p className="muted">{t('noMessages')}</p>}
              {messages.map((item) => {
                const meta = mediaMetadata(item.message);
                const view = mediaViews[item.message.id];
                const matrix = deliveryMatrix(item.message, peers);
                const acked = matrix.filter((r) => r.acked).length;
                return (
                  <div key={item.message.id} className={`msg ${item.status}`}>
                    <div className="msg-head">
                      <strong>{item.message.from === identity?.public.fingerprint ? 'Me' : (peers.find((p) => p.fingerprint === item.message.from)?.displayName ?? item.message.from.slice(0, 10))}</strong>
                      <span>{new Date(item.message.createdAt).toLocaleTimeString()}</span>
                      <span className="badge">{t(item.status === 'sent' ? 'sent' : item.status === 'delivered' ? 'delivered' : item.status === 'expired' ? 'expired' : 'pending')}</span>
                    </div>
                    <div className="msg-body">
                      {view && view.kind === 'photo' && <img className="snap" src={view.url} alt={view.name} />}
                      {view && view.kind === 'video' && <video className="snap" src={view.url} controls playsInline />}
                      {view && view.kind === 'audio' && <audio controls src={view.url} />}
                      {!view && (plaintext[item.message.id] ?? (meta ? `📎 ${meta.name}` : '[encrypted]'))}
                    </div>
                    {item.error && <div className="error">{item.error}</div>}
                    {peers.length > 0 && <div className="ack">✓ {acked}/{peers.length} {t('signedAck')}</div>}
                    {playingId === item.message.id && <div className="ack">▶ {t('pttBurst')}</div>}
                  </div>
                );
              })}
            </div>

            <div className="card composer">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void sendText(); }}
                placeholder={t('messagePlaceholder')} disabled={peers.length === 0} />
              <button onClick={() => void sendText()} disabled={!input.trim() || peers.length === 0}>{t('send')}</button>
            </div>
          </section>
        )}

        {tab === 'media' && (
          <section>
            <div className="card">
              <h3>{t('pttBurst')}</h3>
              <p className="muted">{t('tagline')}. {caps.voice ? '' : t('partTranslation')}</p>
              <button className={recording ? 'danger' : ''} onClick={() => void togglePtt()}>
                {recording ? t('stopSend') : t('recordPtt')}
              </button>
            </div>
            <div className="card">
              <h3>{t('videoSnaps')}</h3>
              <div className="row">
                <button className={videoRecording ? 'danger' : ''} onClick={() => void toggleVideoSnap()}>
                  {videoRecording ? t('stopSend') : t('recordVideo')}
                </button>
                <label className="file-button">{t('chooseVideo')}
                  <input type="file" accept="video/*,image/*" onChange={(e) => void onFilePicked('snap', e)} />
                </label>
                <label className="file-button">{t('chooseFile')}
                  <input type="file" accept="*/*" onChange={(e) => void onFilePicked('file', e)} />
                </label>
              </div>
            </div>
            <div className="card">
              <h3>{t('offlineTransfer')}</h3>
              <div className="row">
                <label className="file-button">{t('chooseFile')}
                  <input type="file" onChange={(e) => void exportBundle(e)} />
                </label>
                {outgoingBundle && <button onClick={() => download('leeway-offline-bundle.json', outgoingBundle)}>{t('downloadBundle')}</button>}
                <label className="file-button">{t('receiveBundle')}
                  <input type="file" accept="application/json" onChange={(e) => void importBundle(e)} />
                </label>
              </div>
              {incomingBundle && <p>Decrypted: <strong>{incomingBundle.name}</strong> ({incomingBundle.bytes.length} bytes)
                <button onClick={() => download(incomingBundle.name, bytesToBase64(incomingBundle.bytes), 'application/octet-stream')}>{t('downloadBundle')}</button>
              </p>}
            </div>
          </section>
        )}

        {tab === 'room' && (
          <section>
            <div className="card">
              <h3>{t('privateRoom')}</h3>
              <p className="muted">Opt-in live mode only. The walkie-talkie dispatch timeline remains the offline-first foundation. Live audio/video requires an online peer and signaling path.</p>
              <div className="row">
                <button onClick={() => void openPrivateRoom()}>{t('openRoom')}</button>
                <button onClick={() => void startLiveMedia(false)} disabled={!roomActive}>{t('voiceCall')}</button>
                <button onClick={() => void startLiveMedia(true)} disabled={!roomActive}>{t('videoCall')}</button>
                <button onClick={leaveRoom} disabled={!roomActive}>{t('leaveRoom')}</button>
              </div>
              <p>{t('members')}: {peers.length} · {roomActive ? t('available') : t('notCreated')}</p>
            </div>
          </section>
        )}

        {tab === 'network' && (
          <section>
            <div className="card">
              <h3>{t('gateways')}</h3>
              <p className="muted">Routes qualify only when a trusted LeeWay Device Bridge / Federate authority signs the declaration, the capability token is valid, the room is in scope, encryption and bidirectional ACKs exist, and link quality is sufficient.</p>
              <div className="row">
                <button onClick={() => void addDemoGateway()}>{t('addDemoGateway')}</button>
                <button onClick={() => void refreshNetwork()}>{t('refresh')}</button>
              </div>
              <h4>Trusted authority JWK</h4>
              <textarea value={authorityInput} onChange={(e) => setAuthorityInput(e.target.value)} placeholder='{"kty":"OKP","crv":"Ed25519",...}' />
              <button onClick={() => {
                try {
                  const jwk = JSON.parse(authorityInput) as JsonWebKey;
                  session.current.transport?.authorities.add({
                    id: `authority-${Date.now().toString(36)}`, label: 'Imported authority',
                    publicJwk: jwk, source: 'imported', trustedAt: Date.now(),
                  });
                  addLog('authority trusted; signatures will be verified');
                } catch (err) { addLog(`authority error: ${String(err)}`); }
              }}>Trust authority</button>
              <h4>Gateway declaration JSON</h4>
              <textarea value={gatewayInput} onChange={(e) => setGatewayInput(e.target.value)} />
              <button onClick={() => {
                try {
                  const g = JSON.parse(gatewayInput) as GatewayDeclaration;
                  session.current.transport?.addGateway(g);
                  void refreshNetwork();
                  addLog(`gateway ${g.id} imported (${g.verification})`);
                } catch (err) { addLog(`gateway error: ${String(err)}`); }
              }}>Import gateway</button>
            </div>
            <div className="card">
              <h4>{t('gateways')} ({gateways.length})</h4>
              {gateways.map((g) => <div key={g.id} className="gateway">
                <strong>{g.kind}</strong> · {g.id}<br />
                <span className="muted">{g.issuer} · quality {g.capabilities.linkQuality} · {g.verification}</span><br />
                <span className="muted">{g.note ?? g.endpoint}</span>
              </div>)}
              <p className="warn">{t('satellite')}: {satelliteStatus}. Tracking satellites is not a message uplink.</p>
            </div>
          </section>
        )}

        {tab === 'setup' && (
          <section>
            <div className="card">
              <h3>Private circle &amp; service window</h3>
              <p className="muted">A circle ID is verified by a signed service grant. Grants carry a fingerprint, rights, scope and expiry; revoked or expired grants are rejected by qualified service routes.</p>
              <input value={circleId} onChange={(e) => setCircleId(e.target.value)} placeholder="circle-…" />
              <div className="row">
                <select value={serviceWindow} onChange={(e) => setServiceWindow(e.target.value as '6m' | '1y')}>
                  <option value="6m">6-month service window</option>
                  <option value="1y">1-year service window</option>
                </select>
                <button onClick={() => void makeDemoGrant()}>Issue local demo grant</button>
              </div>
              <textarea value={grantInput} onChange={(e) => setGrantInput(e.target.value)} placeholder="Paste signed service grant JSON" />
              <div className="row">
                <button onClick={() => {
                  try {
                    const parsed = JSON.parse(grantInput);
                    const payload = typeof parsed.token === 'string' ? JSON.parse(parsed.token).payload : parsed.payload;
                    setGrant({ token: parsed.token ?? grantInput, payload, status: 'active' });
                    if (payload?.circleId) setCircleId(payload.circleId);
                    addLog('service grant loaded; membership will be verified on connect');
                  } catch (err) { addLog(`grant import failed: ${String(err)}`); }
                }}>Import grant</button>
                {grant && <button onClick={() => { setGrant(null); setCircleStatus('grant cleared locally'); }}>Clear grant</button>}
              </div>
              <p>Status: <strong>{circleStatus}</strong></p>
              {grant && <p className="muted">Grant {grant.payload.grantId.slice(0, 12)} · {grant.payload.scope} · expires {new Date(grant.payload.expiresAt).toLocaleDateString()}</p>}
            </div>
            <div className="card">
              <h3>Tiered family delivery</h3>
              {DELIVERY_TIERS.map((tier) => <p key={tier.tier}><strong>{tier.tier}:</strong> {tier.method} — <span className="muted">{tier.note}</span></p>)}
            </div>
            <div className="card">
              <h3>Platform ({platformCaps.label})</h3>
              <p className="muted">One dispatch core on Android, iPhone/iOS, Windows, macOS, Linux and Web/PWA. Native/wrapper testing per OS: <strong>{platformCaps.physicalVerification}</strong>.</p>
              <div className="status-card">
                <div><span className="label">Media capture</span><span className="value">{platformCaps.mediaCapture ? 'AVAILABLE' : 'NOT VERIFIED'}</span></div>
                <div><span className="label">Audio formats</span><span className="value">{platformCaps.audioMimeTypes.join(', ') || 'none'}</span></div>
                <div><span className="label">Video formats</span><span className="value">{platformCaps.videoMimeTypes.join(', ') || 'none'}</span></div>
                <div><span className="label">Persistence</span><span className="value">{platformCaps.persistence}</span></div>
                <div><span className="label">Private room</span><span className="value">{platformCaps.privateRoom ? 'AVAILABLE' : 'NOT VERIFIED'}</span></div>
              </div>
            </div>
            <div className="card">
              <h3>{t('identity')} &amp; {t('pair')}</h3>
              {!identity ? <>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('displayName')} />
                <button onClick={() => void createIdentity()}>{t('createIdentity')}</button>
              </> : <>
                <p><code>{identity.public.fingerprint}</code></p>
                <div className="row">
                  <button onClick={() => void makeInvitation()}>Generate invite QR + link</button>
                  <label className="file-button">Invite/identity bundle
                    <input type="file" accept="application/json" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) { setPeerInput(await f.text()); addLog('invite bundle loaded — review and pair'); }
                    }} />
                  </label>
                </div>
                {invitationQr && <div className="qr"><img src={invitationQr} alt="Pairing QR" /></div>}
                {inviteLink && <p className="muted">Invite link (needs network to open): <code>{inviteLink.slice(0, 120)}…</code>
                  <button onClick={() => void navigator.clipboard?.writeText(inviteLink)}>Copy link</button>
                </p>}
                <p className="muted">QR is for face-to-face pairing; the link carries signed identity data but is not itself a trust authority.</p>
              </>}
              <h4>{t('members')}</h4>
              <textarea value={peerInput} onChange={(e) => setPeerInput(e.target.value)} placeholder="Paste member identity / invitation JSON" />
              <button onClick={importPeer}>{t('addMember')}</button>
              {peers.map((p) => <div key={p.fingerprint} className="gateway">
                <strong>{p.displayName}</strong> · {p.fingerprint.slice(0, 16)} {p.region ? `· ${p.region}` : ''}
              </div>)}
            </div>
            <div className="card">
              <h3>{t('relay')}</h3>
              <input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)} placeholder="ws://host:8787" />
              <div className="row">
                <button onClick={() => void connectRelay()}>{t('connect')}</button>
                <button onClick={() => { session.current.relay?.close(); setRelayState('disconnected'); }}>{t('disconnect')}</button>
              </div>
            </div>
            <div className="card">
              <h3>{t('activityLog')}</h3>
              <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
