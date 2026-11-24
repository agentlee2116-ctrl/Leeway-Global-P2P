/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.FILES
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P product engineering
WHAT: Encrypted attachment and walkie-talkie media-burst helpers
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/files.ts
WHY: Voice bursts, photos, video snaps and files must travel as self-contained encrypted bundles
HOW: WebCrypto ECDH/AES-GCM envelopes plus signed, SHA-256-bound metadata over one shared dispatch model
*/
import {
  base64ToBytes, bytesToBase64, decryptDispatchBody, decryptFrom, encryptFor,
  encryptForRecipients, sha256,
} from './crypto.ts';
import type { Attachment, MediaMetadata } from './types.ts';

export async function encryptAttachment(params: {
  file: { name: string; type: string; size: number; bytes: Uint8Array };
  recipientAgreementJwk: JsonWebKey;
  senderFingerprint: string;
}): Promise<Attachment> {
  const digest = await sha256(params.file.bytes);
  const envelope = await encryptFor(
    bytesToBase64(params.file.bytes),
    params.recipientAgreementJwk,
    params.senderFingerprint,
  );
  return {
    name: params.file.name,
    mime: params.file.type || 'application/octet-stream',
    size: params.file.size,
    encryptedBytes: bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope))),
    sha256: digest,
  };
}

export async function decryptAttachment(
  attachment: Attachment,
  recipientPrivateAgreement: CryptoKey,
  senderFingerprint: string,
): Promise<Uint8Array> {
  const envelope = JSON.parse(new TextDecoder().decode(base64ToBytes(attachment.encryptedBytes)));
  const b64 = await decryptFrom(envelope, recipientPrivateAgreement, senderFingerprint);
  return base64ToBytes(b64);
}

/**
 * Builds a self-contained encrypted media burst (PTT clip, photo, video snap
 * or file) with metadata that is bound by the dispatch signature.
 */
export async function encryptMediaBurst(params: {
  name: string;
  mime: string;
  bytes: Uint8Array;
  recipients: Array<{ fingerprint: string; agreement: JsonWebKey }>;
  senderFingerprint: string;
  media: MediaMetadata['media'];
  durationMs?: number;
  width?: number;
  height?: number;
}): Promise<{
  body: string;
  attachment: Attachment;
  metadata: MediaMetadata;
}> {
  const metadata: MediaMetadata = {
    media: params.media,
    mime: params.mime,
    name: params.name,
    sha256: await sha256(params.bytes),
    size: params.bytes.length,
    durationMs: params.durationMs,
    width: params.width,
    height: params.height,
    ptt: params.media === 'audio',
  };
  const recipient = params.recipients[0];
  if (!recipient) throw new Error('A media burst needs at least one recipient');
  const attachment = await encryptAttachment({
    file: { name: params.name, type: params.mime, size: params.bytes.length, bytes: params.bytes },
    recipientAgreementJwk: recipient.agreement,
    senderFingerprint: params.senderFingerprint,
  });
  const body = await encryptForRecipients({
    plaintext: bytesToBase64(params.bytes),
    recipients: params.recipients,
    senderFingerprint: params.senderFingerprint,
    meta: metadata,
  });
  return { body, attachment, metadata };
}

/** Splits a large base64 payload into QR-safe chunks for physical transfer. */
export function chunkForQr(base64: string, maxChars = 900): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += maxChars) chunks.push(base64.slice(i, i + maxChars));
  return chunks;
}

export function joinQrChunks(chunks: string[]): string {
  return chunks.join('');
}
