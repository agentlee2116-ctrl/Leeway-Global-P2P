/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TESTS_DISPATCH
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P product engineering
WHAT: Multi-recipient dispatch, per-recipient ACK and media burst tests
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/dispatch.test.ts
WHY: Family rooms span regions; one offline member must not block delivery to others
HOW: Real WebCrypto operations and negative cases against the shipped core modules
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, decryptDispatchBody, encryptForRecipients } from '../src/core/crypto.ts';
import {
  addAck, createAck, createMessage, deliveryMatrix, isFullyAcknowledged, mediaMetadata, verifyMessage,
} from '../src/core/messages.ts';
import { encryptMediaBurst } from '../src/core/files.ts';
import { createInviteLink, DELIVERY_TIERS, parseInvite } from '../src/core/invite.ts';
import { MemoryMessageStore } from '../src/core/storage.ts';
import { LANGUAGES, translationCoverage, translator } from '../src/i18n.ts';
import type { MediaMetadata } from '../src/core/types.ts';

test('dispatch is encrypted separately for every room member', async () => {
  const sender = await generateIdentity('Parent US');
  const saudi = await generateIdentity('Member Saudi Arabia');
  const china = await generateIdentity('Member China');
  const britain = await generateIdentity('Member Britain');
  const members = [saudi, china, britain];

  const body = await encryptForRecipients({
    plaintext: 'Family dispatch: all safe', recipients: members.map((m) => ({
      fingerprint: m.public.fingerprint, agreement: m.public.agreement,
    })), senderFingerprint: sender.public.fingerprint,
  });

  for (const member of members) {
    const result = await decryptDispatchBody({
      body, selfFingerprint: member.public.fingerprint,
      selfAgreementPrivate: member.agreement, senderFingerprint: sender.public.fingerprint,
    });
    assert.equal(result.plaintext, 'Family dispatch: all safe');
  }
  const outsider = await generateIdentity('Outsider');
  await assert.rejects(() => decryptDispatchBody({
    body, selfFingerprint: outsider.public.fingerprint,
    selfAgreementPrivate: outsider.agreement, senderFingerprint: sender.public.fingerprint,
  }), /no copy addressed/);
});

test('per-recipient ACK state is independent', async () => {
  const sender = await generateIdentity('Sender');
  const a = await generateIdentity('UK');
  const b = await generateIdentity('CN');
  const message = await createMessage({
    roomId: 'family', kind: 'text', from: sender.public.fingerprint,
    body: 'encrypted', privateSigningKey: sender.signing, senderPublicJwk: sender.public.signing,
  });
  const recipients = [{ fingerprint: a.public.fingerprint, displayName: 'UK' }, { fingerprint: b.public.fingerprint, displayName: 'CN' }];

  assert.deepEqual(deliveryMatrix(message, recipients).map((r) => r.acked), [false, false]);
  const ackA = await createAck(message, a.public.fingerprint, 'community-mesh', a.signing);
  const updated = { ...message, acknowledgements: [...message.acknowledgements, ackA] };
  assert.deepEqual(deliveryMatrix(updated, recipients).map((r) => r.acked), [true, false]);
  assert.equal(await verifyMessage(updated, sender.public.signing), true);
});

test('offline queue retains a multi-recipient dispatch until every signed ACK arrives', async () => {
  const sender = await generateIdentity('Sender');
  const uk = await generateIdentity('UK');
  const cn = await generateIdentity('China');
  const store = new MemoryMessageStore();
  const message = await createMessage({
    roomId: 'family', kind: 'ptt', from: sender.public.fingerprint,
    recipients: [uk.public.fingerprint, cn.public.fingerprint], body: 'encrypted-burst',
    ttlMs: 60_000, privateSigningKey: sender.signing, senderPublicJwk: sender.public.signing,
  });
  await store.put({ message, attempts: 1, status: 'queued', error: 'no live link' });
  assert.equal((await store.all()).filter((i) => i.status === 'queued').length, 1);
  assert.equal(isFullyAcknowledged(message), false);

  const ackUk = await createAck(message, uk.public.fingerprint, 'community-mesh', uk.signing);
  const partial = addAck(message, ackUk);
  assert.equal(isFullyAcknowledged(partial), false, 'one member online must not drop the other');
  await store.put({ message: partial, attempts: 1, status: 'queued' });

  const ackCn = await createAck(message, cn.public.fingerprint, 'satellite-gateway', cn.signing);
  const complete = addAck(partial, ackCn);
  assert.equal(isFullyAcknowledged(complete), true);
  await store.put({ message: complete, attempts: 2, status: 'delivered' });
  assert.equal((await store.all()).filter((i) => i.status === 'delivered').length, 1);
  assert.equal(verifyMessage(complete, sender.public.signing) instanceof Promise, true);
  assert.equal(await verifyMessage(complete, sender.public.signing), true, 'ACKs do not invalidate the dispatch signature');
});

test('PTT, photo and video bursts carry signed metadata', async () => {
  const sender = await generateIdentity('Sender');
  const recipient = await generateIdentity('Recipient');
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  for (const media of ['audio', 'photo', 'video', 'file'] as MediaMetadata['media'][]) {
    const burst = await encryptMediaBurst({
      name: `clip.${media}`, mime: media === 'audio' ? 'audio/webm' : media === 'video' ? 'video/webm' : 'application/octet-stream',
      bytes, recipients: [{ fingerprint: recipient.public.fingerprint, agreement: recipient.public.agreement }],
      senderFingerprint: sender.public.fingerprint, media, durationMs: 1500,
    });
    const message = await createMessage({
      roomId: 'family', kind: media === 'audio' ? 'ptt' : media === 'file' ? 'file' : 'snap',
      from: sender.public.fingerprint, body: burst.body,
      privateSigningKey: sender.signing, senderPublicJwk: sender.public.signing,
    });
    assert.equal(await verifyMessage(message, sender.public.signing), true);
    assert.equal(mediaMetadata(message)?.media, media);
    assert.equal(mediaMetadata(message)?.durationMs, 1500);
    const result = await decryptDispatchBody({
      body: burst.body, selfFingerprint: recipient.public.fingerprint,
      selfAgreementPrivate: recipient.agreement, senderFingerprint: sender.public.fingerprint,
    });
    assert.ok(result.plaintext.length > 0);
    assert.equal(result.meta?.media, media);
  }
});

test('invite link carries verified identity data and is not itself trusted', async () => {
  const member = await generateIdentity('Member Saudi Arabia');
  const invitation = {
    v: 1 as const, displayName: member.public.displayName, fingerprint: member.public.fingerprint,
    roomId: 'family-room', createdAt: Date.now(),
  };
  const link = createInviteLink('https://example.org/app/', invitation);
  assert.ok(link.includes('#join='));
  const parsed = parseInvite(link);
  assert.equal(parsed?.fingerprint, member.public.fingerprint);
  assert.equal(parsed?.roomId, 'family-room');
  assert.equal(parseInvite(JSON.stringify(invitation))?.fingerprint, member.public.fingerprint);
  assert.equal(parseInvite('https://example.org/app/#join=invalid'), null);
  assert.equal(parseInvite('https://example.org/app/'), null);
  assert.equal(DELIVERY_TIERS.length, 3);
});

test('multilingual registry covers named regions and reports honest coverage', () => {
  const codes: string[] = LANGUAGES.map(([code]) => code);
  for (const required of ['en', 'ar', 'zh', 'zh-TW', 'en-GB', 'hi', 'es', 'fr', 'ru']) {
    assert.ok(codes.includes(required), `missing locale ${required}`);
  }
  assert.equal(translator('zh')('send'), '发送');
  assert.equal(translator('ar')('send'), 'إرسال');
  assert.equal(translator('de')('send'), 'Senden');
  assert.equal(translator('xx')('send'), 'Send');
  assert.ok(translationCoverage('en') === 100);
  assert.ok(translationCoverage('xx') < 100);
  assert.ok(LANGUAGES.length >= 60);
});
