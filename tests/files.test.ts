/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.FILES_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: tests\files.test.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/files.test.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity, sha256 } from '../src/core/crypto.ts';
import { createMessage, verifyMessage } from '../src/core/messages.ts';
import { buildTransferBundle, parseTransferBundle } from '../src/core/storage.ts';
import { chunkForQr, decryptAttachment, encryptAttachment, joinQrChunks } from '../src/core/files.ts';

test('video clip is encrypted, signed, transferred and decrypted intact', async () => {
  const alice = await generateIdentity('Alice');
  const bob = await generateIdentity('Bob');
  const clip = new Uint8Array([0x1a, 0x45, 0xdf, 0x00, 0x11, 0x22, 0x33, 0x44]);

  const attachment = await encryptAttachment({
    file: { name: 'leeway-clip.webm', type: 'video/webm', size: clip.length, bytes: clip },
    recipientAgreementJwk: bob.public.agreement,
    senderFingerprint: alice.public.fingerprint,
  });
  assert.equal(attachment.mime, 'video/webm');
  assert.equal(attachment.sha256, await sha256(clip));

  const message = await createMessage({
    roomId: 'room-1', kind: 'file', from: alice.public.fingerprint, to: bob.public.fingerprint,
    body: Buffer.from(JSON.stringify({ name: attachment.name, mime: attachment.mime, media: 'video', sha256: attachment.sha256 })).toString('base64'),
    privateSigningKey: alice.signing, senderPublicJwk: alice.public.signing,
  });
  assert.equal(await verifyMessage(message, alice.public.signing), true);

  const bundle = buildTransferBundle(message, attachment, alice.public.fingerprint);
  const parsed = parseTransferBundle(bundle);
  assert.equal(await verifyMessage(parsed.message, alice.public.signing), true);
  const restored = await decryptAttachment(parsed.attachment, bob.agreement, alice.public.fingerprint);
  assert.deepEqual(restored, clip);

  const metadata = JSON.parse(Buffer.from(parsed.message.body as string, 'base64').toString());
  assert.equal(metadata.media, 'video');
  assert.equal(metadata.mime, 'video/webm');
});

test('encrypted video bundle splits and rejoins for QR/physical transfer', async () => {
  const alice = await generateIdentity('Alice');
  const bob = await generateIdentity('Bob');
  const clip = new Uint8Array(200).fill(7);
  const attachment = await encryptAttachment({
    file: { name: 'clip.mp4', type: 'video/mp4', size: clip.length, bytes: clip },
    recipientAgreementJwk: bob.public.agreement,
    senderFingerprint: alice.public.fingerprint,
  });
  const chunks = chunkForQr(attachment.encryptedBytes, 100);
  assert.ok(chunks.length > 1);
  assert.equal(joinQrChunks(chunks), attachment.encryptedBytes);
  assert.deepEqual(await decryptAttachment({ ...attachment, encryptedBytes: joinQrChunks(chunks) }, bob.agreement, alice.public.fingerprint), clip);
});
