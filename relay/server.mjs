/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.SERVER
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: relay\server.mjs
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/relay/server.mjs
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/**
 * LeeWay Global P2P — minimal signaling / relay service.
 * Authenticated challenge-response (Ed25519), room-scoped forwarding.
 * This is an OPTIONAL internet relay, never the foundation of offline comms.
 */
import { WebSocketServer, WebSocket } from 'ws';
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const enc = new TextEncoder();
// Optional circle enforcement. When no authority JWK is configured the relay
// runs in open mode and reports that fact; it never claims verified membership.
let CIRCLE_AUTHORITY_JWK = null;
try { CIRCLE_AUTHORITY_JWK = process.env.LEEWAY_CIRCLE_AUTHORITY_JWK ? JSON.parse(process.env.LEEWAY_CIRCLE_AUTHORITY_JWK) : null; } catch { CIRCLE_AUTHORITY_JWK = null; }
const CIRCLE_ADMIN = process.env.LEEWAY_CIRCLE_ADMIN || '';
const revokedGrants = new Set((process.env.LEEWAY_REVOKED_GRANTS || '').split(',').map((s) => s.trim()).filter(Boolean));

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

const wss = new WebSocketServer({ host: HOST, port: PORT });
const rooms = new Map(); // roomId -> Set<WebSocket>
const peers = new WeakMap(); // ws -> { fingerprint, publicJwk, authenticated, roomId, challenge }

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function joinRoom(ws, roomId) {
  const info = peers.get(ws);
  if (info.roomId) rooms.get(info.roomId)?.delete(ws);
  info.roomId = roomId;
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);
  send(ws, { type: 'joined', roomId, peers: rooms.get(roomId).size });
}

async function verifySignature(publicJwk, signatureB64, data) {
  try {
    const key = await crypto.subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, false, ['verify']);
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('Ed25519', key, sig, enc.encode(data));
  } catch {
    return false;
  }
}

function messageSigningBody(m) {
  return canonical({
    id: m.id, roomId: m.roomId, circleId: m.circleId, kind: m.kind, from: m.from, to: m.to, recipients: m.recipients,
    body: m.body, createdAt: m.createdAt, expiresAt: m.expiresAt, nonce: m.nonce,
  });
}

async function validateGrant(token, circleId, now = Date.now()) {
  if (!CIRCLE_AUTHORITY_JWK) return { ok: true, open: true };
  if (!token || !circleId) return { ok: false, code: 'grant-required' };
  let signed;
  try { signed = JSON.parse(token); } catch { return { ok: false, code: 'grant-invalid' }; }
  const ok = await verifySignature(CIRCLE_AUTHORITY_JWK, signed.signature, canonical(signed.payload));
  if (!ok) return { ok: false, code: 'grant-invalid' };
  const p = signed.payload || {};
  if (p.circleId !== circleId) return { ok: false, code: 'circle-mismatch' };
  if (revokedGrants.has(p.grantId)) return { ok: false, code: 'grant-revoked' };
  if (typeof p.expiresAt !== 'number' || p.expiresAt <= now) return { ok: false, code: 'grant-expired' };
  if (!Array.isArray(p.rights) || !p.rights.includes('join')) return { ok: false, code: 'grant-invalid' };
  if (p.scope !== 'relay' && p.scope !== 'service') return { ok: false, code: 'grant-invalid' };
  return { ok: true, grantId: p.grantId };
}

wss.on('connection', (ws) => {
  peers.set(ws, { fingerprint: null, publicJwk: null, authenticated: false, roomId: null, challenge: null });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', code: 'bad-json' }); }
    const info = peers.get(ws);

    try {
      switch (msg.type) {
        case 'hello': {
          if (!msg.fingerprint || !msg.publicJwk) return send(ws, { type: 'error', code: 'hello-incomplete' });
          info.fingerprint = msg.fingerprint;
          info.publicJwk = msg.publicJwk;
          info.challenge = crypto.randomUUID();
          send(ws, { type: 'challenge', nonce: info.challenge });
          break;
        }
        case 'auth': {
          if (!info.challenge) return send(ws, { type: 'error', code: 'no-challenge' });
          const ok = await verifySignature(info.publicJwk, msg.signature, info.challenge);
          if (!ok) return send(ws, { type: 'error', code: 'auth-failed' });
          info.authenticated = true;
          info.challenge = null;
          send(ws, { type: 'authenticated', fingerprint: info.fingerprint });
          break;
        }
        case 'join': {
          if (!info.authenticated) return send(ws, { type: 'error', code: 'not-authenticated' });
          if (typeof msg.roomId !== 'string' || !msg.roomId) return send(ws, { type: 'error', code: 'invalid-room' });
          const grant = await validateGrant(msg.grantToken, msg.circleId);
          if (!grant.ok) return send(ws, { type: 'error', code: grant.code });
          info.circleId = msg.circleId || null;
          info.grantId = grant.grantId || null;
          joinRoom(ws, msg.roomId);
          send(ws, { type: 'circle-status', enforced: !grant.open, circleId: info.circleId, grantId: info.grantId });
          break;
        }
        case 'revoke': {
          if (!CIRCLE_ADMIN || info.fingerprint !== CIRCLE_ADMIN) {
            return send(ws, { type: 'error', code: 'not-authorized' });
          }
          if (typeof msg.grantId === 'string') revokedGrants.add(msg.grantId);
          send(ws, { type: 'revoked', grantId: msg.grantId });
          break;
        }
        case 'publish': {
          if (!info.authenticated) return send(ws, { type: 'error', code: 'not-authenticated' });
          const m = msg.message;
          if (!m || m.roomId !== info.roomId || m.from !== info.fingerprint) {
            return send(ws, { type: 'error', code: 'message-mismatch' });
          }
          if (CIRCLE_AUTHORITY_JWK) {
            if (m.circleId !== info.circleId) return send(ws, { type: 'error', code: 'circle-mismatch' });
            const grant = await validateGrant(msg.grantToken, info.circleId);
            if (!grant.ok) return send(ws, { type: 'error', code: grant.code });
          }
          if (typeof m.expiresAt === 'number' && m.expiresAt <= Date.now()) {
            return send(ws, { type: 'error', code: 'message-expired' });
          }
          const ok = await verifySignature(info.publicJwk, m.signature, messageSigningBody(m));
          if (!ok) return send(ws, { type: 'error', code: 'bad-signature' });
          const frame = JSON.stringify({ type: 'deliver', message: m, route: 'internet-relay' });
          let delivered = 0;
          for (const peer of rooms.get(info.roomId) ?? []) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) { peer.send(frame); delivered++; }
          }
          send(ws, { type: 'published', id: m.id, delivered });
          break;
        }
        case 'signal': {
          if (!info.authenticated) return send(ws, { type: 'error', code: 'not-authenticated' });
          const frame = JSON.stringify({ type: 'signal', from: info.fingerprint, roomId: info.roomId, data: msg.data });
          for (const peer of rooms.get(info.roomId) ?? []) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(frame);
          }
          break;
        }
        case 'ack': {
          if (!info.authenticated) return send(ws, { type: 'error', code: 'not-authenticated' });
          if (msg.ack?.payload?.recipient !== info.fingerprint) {
            return send(ws, { type: 'error', code: 'ack-mismatch' });
          }
          const frame = JSON.stringify({ type: 'ack', from: info.fingerprint, roomId: info.roomId, ack: msg.ack });
          for (const peer of rooms.get(info.roomId) ?? []) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(frame);
          }
          send(ws, { type: 'ack-published', messageId: msg.ack.payload.messageId });
          break;
        }
        case 'ping': send(ws, { type: 'pong', at: Date.now() }); break;
        default: send(ws, { type: 'error', code: 'unknown-type' });
      }
    } catch (err) {
      send(ws, { type: 'error', code: 'internal', detail: String(err?.message ?? err) });
    }
  });

  ws.on('close', () => {
    const info = peers.get(ws);
    if (info?.roomId) rooms.get(info.roomId)?.delete(ws);
  });
});

console.log(`[leeway-relay] listening on ${HOST}:${PORT}`);
