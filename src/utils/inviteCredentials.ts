/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.INVITE_CREDENTIALS
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Credential-carrying family invite links with first-login password rotation
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/inviteCredentials.ts
WHY: A bare invite link is a bearer secret; bind it to a named recipient and a temporary password
HOW: Base64url token in the URL fragment (never sent to a server), OS hint for install routing, PBKDF2 verifier stored locally
*/
import { detectOs, type OsFamily } from '../platform/index.ts';

export interface InviteCredentials {
  v: 1;
  /** Carried in the query string; the QR fragment omits it to stay scannable. */
  inviteToken?: string;
  recipientName: string;
  recipientAddress: string;
  username: string;
  temporaryPassword: string;
  circleName: string;
  createdAt: number;
  expiresAt: number;
  osHint: OsFamily;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(text: string): string {
  const bytes = encoder.encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return decoder.decode(bytes);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function makeTemporaryPassword(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function makeUsername(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 18) || 'family';
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const suffix = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('').toLowerCase();
  return `${base}.${suffix}`;
}

/** Builds the shareable link. Credentials live in the fragment so they are not transmitted to the hosting server. */
export function encodeRecipientInviteUrl(
  credentials: InviteCredentials,
  baseUrl = 'https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/join/',
): string {
  // The signed invite token travels once in the query. The fragment carries
  // only the small credential envelope, keeping the QR well within capacity.
  const { inviteToken: _token, ...fragmentPayload } = credentials;
  const token = toBase64Url(JSON.stringify(fragmentPayload));
  const query = `?invite=${encodeURIComponent(_token ?? '')}`;
  return `${baseUrl}${query}#join=${token}`;
}

export function parseRecipientInviteUrl(input: string): InviteCredentials | null {
  try {
    const raw = input.trim();
    // Prefer the credential-bearing fragment; the legacy ?invite= token has no password.
    const match = raw.match(/[#&]join=([A-Za-z0-9_\-]+)/) ?? raw.match(/[?#&]invite=([A-Za-z0-9_\-:.]+)/);
    if (!match) return null;
    const candidate = match[1];
    if (candidate.startsWith('LWINV1:')) return null; // Legacy token: no credentials attached.
    const parsed = JSON.parse(fromBase64Url(candidate)) as InviteCredentials;
    const queryToken = raw.match(/[?&]invite=([A-Za-z0-9_:.%\-]+)/)?.[1];
    if (queryToken) parsed.inviteToken = decodeURIComponent(queryToken);
    if (parsed?.v !== 1 || !parsed.inviteToken || !parsed.username || !parsed.temporaryPassword) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function localOsHint(): OsFamily {
  if (typeof navigator === 'undefined') return 'unknown';
  return detectOs();
}

export function installInstructions(os: OsFamily): string {
  switch (os) {
    case 'ios': return 'Open in Safari → Share → Add to Home Screen. The invite stays in the link.';
    case 'android': return 'Open in Chrome and install the app, or install the signed APK from the same site.';
    case 'windows':
    case 'macos':
    case 'linux': return 'Open in your browser and use the browser install / Add to Home Screen option.';
    default: return 'Open on any modern browser and install the PWA when prompted.';
  }
}
