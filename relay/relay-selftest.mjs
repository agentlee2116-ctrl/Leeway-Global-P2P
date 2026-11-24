/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.RELAY_SELFTEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: relay\relay-selftest.mjs
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/relay/relay-selftest.mjs
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/**
 * LeeWay Global P2P — real relay integration test.
 * Starts the actual WebSocket relay, authenticates two Ed25519 peers, publishes
 * a signed message, verifies authenticated delivery and ACK forwarding, and
 * exercises negative cases (bad signature, unauthenticated publish, expired).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { webcrypto } from 'node:crypto';
import { WebSocket } from 'ws';

const crypto = webcrypto;
const enc = new TextEncoder();
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
}

function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}

function b64(bytes) { return Buffer.from(bytes).toString('base64'); }

async function identity(name) {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(canonical(publicJwk)));
  return {
    name,
    fingerprint: b64(digest).replace(/[+/=]/g, '').slice(0, 24),
    publicJwk,
    privateKey: pair.privateKey,
    async sign(obj) {
      const data = typeof obj === 'string' ? obj : canonical(obj);
      return b64(await crypto.subtle.sign('Ed25519', pair.privateKey, enc.encode(data)));
    },
  };
}

function messageBody(m) {
  return canonical({ id: m.id, roomId: m.roomId, kind: m.kind, from: m.from, to: m.to, recipients: m.recipients, body: m.body, createdAt: m.createdAt, expiresAt: m.expiresAt, nonce: m.nonce });
}

class Client {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.waiters = [];
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      const idx = this.waiters.findIndex((w) => w.type === msg.type);
      if (idx >= 0) { const [w] = this.waiters.splice(idx, 1); w.resolve(msg); }
    });
  }
  open() { return new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); }); }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  wait(type, ms = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), ms);
      this.waiters.push({ type, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }
  async authenticate(id, room) {
    this.send({ type: 'hello', fingerprint: id.fingerprint, publicJwk: id.publicJwk });
    const challenge = await this.wait('challenge');
    const signature = b64(await crypto.subtle.sign('Ed25519', id.privateKey, enc.encode(challenge.nonce)));
    this.send({ type: 'auth', signature });
    await this.wait('authenticated');
    this.send({ type: 'join', roomId: room });
    await this.wait('joined');
  }
  close() { this.ws.close(); }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

async function circleEnforcementTests() {
  console.log('  -- circle enforcement --');
  const authority = await identity('Circle Authority');
  const circleId = 'circle-family';
  const grantFor = async (expiresAt, grantId) => {
    const payload = { grantId, circleId, scope: 'relay', rights: ['join', 'send', 'receive', 'ack'], issuedAt: Date.now() - 1000, expiresAt, fingerprint: authority.fingerprint };
    return JSON.stringify({ v: 1, payload, signer: authority.fingerprint, signature: await authority.sign(canonical(payload)) });
  };
  const valid = await grantFor(Date.now() + 60000, 'grant-valid');
  const expired = await grantFor(Date.now() - 1000, 'grant-expired');
  const revoked = await grantFor(Date.now() + 60000, 'grant-revoked');

  const port = await freePort();
  const server = spawn(process.execPath, ['relay/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(port), HOST: '127.0.0.1',
      LEEWAY_CIRCLE_AUTHORITY_JWK: JSON.stringify(authority.publicJwk),
      LEEWAY_REVOKED_GRANTS: 'grant-revoked',
      LEEWAY_CIRCLE_ADMIN: authority.fingerprint,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', (d) => { stderr += String(d); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`circle relay did not start: ${stderr}`)), 8000);
    server.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`circle relay exited ${code}: ${stderr}`)); });
  });

  // Allow the freshly spawned child a moment to finish binding on Windows.
  await new Promise((resolve) => setTimeout(resolve, 400));

  try {
    const url = `ws://127.0.0.1:${port}`;
    const connect = async () => {
      const c = new Client(url);
      await c.open();
      c.send({ type: 'hello', fingerprint: authority.fingerprint, publicJwk: authority.publicJwk });
      const ch = await c.wait('challenge');
      const signature = b64(await crypto.subtle.sign('Ed25519', authority.privateKey, enc.encode(ch.nonce)));
      c.send({ type: 'auth', signature });
      await c.wait('authenticated');
      return c;
    };

    const c1 = await connect();
    const e1 = c1.wait('error');
    c1.send({ type: 'join', roomId: 'family-room' });
    check('relay rejects join without a circle grant', (await e1).code === 'grant-required');

    const c2 = await connect();
    const e2 = c2.wait('error');
    c2.send({ type: 'join', roomId: 'family-room', circleId, grantToken: expired });
    check('relay rejects an expired service grant', (await e2).code === 'grant-expired');

    const c3 = await connect();
    const e3 = c3.wait('error');
    c3.send({ type: 'join', roomId: 'family-room', circleId, grantToken: revoked });
    check('relay rejects a revoked service grant', (await e3).code === 'grant-revoked');

    const c4 = await connect();
    const statusP = c4.wait('circle-status');
    c4.send({ type: 'join', roomId: 'family-room', circleId, grantToken: valid });
    const status = await statusP;
    check('relay accepts a valid service grant and reports enforcement', status.enforced === true && status.circleId === circleId);

    const e4 = c4.wait('error');
    c4.send({ type: 'publish', message: { ...{ id: 'm1', roomId: 'family-room', circleId: 'wrong-circle', kind: 'text', from: authority.fingerprint, body: 'x', createdAt: Date.now(), expiresAt: Date.now() + 1000, nonce: 'n' }, signature: '' } });
    check('relay rejects a dispatch from a different circle', (await e4).code === 'circle-mismatch');

    [c1, c2, c3, c4].forEach((c) => c.close());
  } finally {
    server.kill();
  }
}

async function main() {
  console.log('LeeWay Global P2P — relay integration selftest');
  const port = await freePort();
  const server = spawn(process.execPath, ['relay/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('relay did not start')), 8000);
    server.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(timer); resolve(); } });
    server.on('error', reject);
  });
  await ready;

  try {
    const url = `ws://127.0.0.1:${port}`;
    const alice = await identity('Alice');
    const bob = await identity('Bob');
    const a = new Client(url);
    const b = new Client(url);
    await Promise.all([a.open(), b.open()]);
    await a.authenticate(alice, 'room-1');
    await b.authenticate(bob, 'room-1');
    check('two peers authenticate and join the same room', true);

    const msg = {
      id: 'msg-1', roomId: 'room-1', kind: 'text', from: alice.fingerprint, to: bob.fingerprint,
      body: 'encrypted-envelope', createdAt: Date.now(), expiresAt: Date.now() + 60000, nonce: 'n-1',
    };
    msg.signature = await alice.sign(messageBody(msg));
    const deliverP = b.wait('deliver');
    a.send({ type: 'publish', message: msg });
    const delivered = await deliverP;
    check('signed message is delivered to the other peer', delivered.message?.id === 'msg-1');
    check('delivery is labelled with the relay route', delivered.route === 'internet-relay');

    const ack = { v: 1, payload: { messageId: 'msg-1', recipient: bob.fingerprint, at: Date.now(), route: 'internet-relay' }, signer: bob.fingerprint, signature: '' };
    ack.signature = await bob.sign(canonical(ack.payload));
    const ackP = a.wait('ack');
    b.send({ type: 'ack', ack });
    check('signed acknowledgement is forwarded to the sender', (await ackP).ack?.payload?.messageId === 'msg-1');

    const badMsg = { ...msg, id: 'msg-bad', body: 'tampered' };
    const errP = a.wait('error');
    a.send({ type: 'publish', message: badMsg });
    check('tampered message is rejected by the relay', (await errP).code === 'bad-signature');

    const expired = { ...msg, id: 'msg-expired', expiresAt: 1, signature: '' };
    expired.signature = await alice.sign(messageBody(expired));
    const errP2 = a.wait('error');
    a.send({ type: 'publish', message: expired });
    check('expired message is rejected by the relay', (await errP2).code === 'message-expired');

    const rogue = new Client(url);
    await rogue.open();
    const errP3 = rogue.wait('error');
    rogue.send({ type: 'publish', message: msg });
    check('unauthenticated publish is rejected', (await errP3).code === 'not-authenticated');

    const rogue2 = new Client(url);
    await rogue2.open();
    rogue2.send({ type: 'hello', fingerprint: 'mallory', publicJwk: alice.publicJwk });
    const ch = await rogue2.wait('challenge');
    rogue2.send({ type: 'auth', signature: b64(new Uint8Array(64)) });
    const errP4 = rogue2.wait('error');
    check('failed challenge response is rejected', ch.nonce && (await errP4).code === 'auth-failed');

    a.close(); b.close(); rogue.close(); rogue2.close();
  } finally {
    server.kill();
  }

  await circleEnforcementTests();

  console.log(`relay selftest: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
