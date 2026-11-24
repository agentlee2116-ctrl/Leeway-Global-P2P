/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.INVITE
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Verifiable family-room invite links and identity bundles
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/invite.ts
WHY: Family members across countries need a simple join flow that verifies keys and room membership
HOW: Base64url-encoded signed identity material; the link is only a carrier and never a trust authority
*/
import { bytesToBase64, base64ToBytes } from './crypto.ts';
import type { PairingInvitation } from './types.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Creates a shareable invite link. The link carries identity data; it does not grant trust by itself. */
export function createInviteLink(baseUrl: string, invitation: PairingInvitation): string {
  const payload = bytesToBase64(enc.encode(JSON.stringify(invitation)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const separator = baseUrl.includes('#') ? '&' : '#';
  return `${baseUrl}${separator}join=${payload}`;
}

/** Reads an invite link or a raw JSON bundle. Returns null when nothing valid is present. */
export function parseInvite(input: string): PairingInvitation | null {
  const trimmed = input.trim();
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed) as PairingInvitation; } catch { return null; }
  }
  const match = trimmed.match(/(?:#|&)join=([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    const b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(dec.decode(base64ToBytes(b64))) as PairingInvitation;
    return parsed?.fingerprint && parsed?.roomId ? parsed : null;
  } catch { return null; }
}

/** Honest explanation of the three delivery tiers for onboarding screens. */
export const DELIVERY_TIERS = [
  { tier: 'Online', method: 'Hosted Web/PWA link or invite link', note: 'Works across countries only when the network reaches the device. Room membership is verified by keys, not by the URL.' },
  { tier: 'In person', method: 'QR code / local share', note: 'For devices sitting next to each other or an air-gapped handoff. A QR is a local payload, not an ocean-crossing transport.' },
  { tier: 'Offline', method: 'Encrypted store-and-forward bundle', note: 'Queue dispatches locally and sync when a link returns, or export/import a bundle by messaging app, email, USB/SD or QR chunks for tiny payloads.' },
] as const;
