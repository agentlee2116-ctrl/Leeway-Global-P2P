/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.FAMILY_SHARE_PANEL
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Configure, generate and share a credential-bound family invitation link on any OS or device
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/FamilySharePanel.tsx
WHY: A named recipient, temporary password and OS install hint must travel with the invite for private, reliable family onboarding
HOW: Web Share API with copy/share-target fallback; credentials live in the URL fragment, never sent to the host
*/
import { useState } from 'react';
import QRCode from 'qrcode';
import {
  Check, Copy, Link2, Mail, MessageCircle, Send, Share2, Smartphone, Users,
} from 'lucide-react';
import type { Translations } from '../utils/i18n';
import type { EnrollmentSession } from '../utils/circleStore';
import { encodeBundleToken, publishRevocationList } from '../utils/circleStore';
import {
  createSignedInvitation, revokeCircleDevice,
  type DeviceKeyRecord, type InviteTtlMinutes, type GrantPeriod,
} from '../utils/enrollmentCrypto';
import {
  encodeRecipientInviteUrl, installInstructions, makeTemporaryPassword, makeUsername,
  type InviteCredentials,
} from '../utils/inviteCredentials';
import type { OsFamily } from '../platform/index.ts';

interface Props {
  t: Translations;
  session: EnrollmentSession;
  deviceKeys: DeviceKeyRecord;
  onUpdateSession: (session: EnrollmentSession) => Promise<void>;
  onNotice: (message: string) => void;
}

const OS_OPTIONS: Array<[OsFamily, string]> = [
  ['ios', 'iPhone / iPad'], ['android', 'Android'], ['windows', 'Windows'],
  ['macos', 'Mac'], ['linux', 'Linux'],
];

export function FamilySharePanel({ t, session, deviceKeys, onUpdateSession, onNotice }: Props) {
  const [ttl, setTtl] = useState<InviteTtlMinutes>(1440);
  const [grantPeriod, setGrantPeriod] = useState<GrantPeriod>('1y');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientOs, setRecipientOs] = useState<OsFamily>('ios');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credentials, setCredentials] = useState<InviteCredentials | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relayUrl, setRelayUrl] = useState(() => localStorage.getItem('lwp.relayUrl') ?? '');
  const authority = session.authority;
  const circleName = authority?.circleName ?? session.circleName;
  const isOwner = session.role === 'owner';

  const makeInvite = async () => {
    setError(null);
    if (!authority || !isOwner) {
      setError('Ask the circle organizer for an invite link.');
      return;
    }
    if (!recipientName.trim() || !recipientAddress.trim()) {
      setError('Enter the family member name and their phone number or email.');
      return;
    }
    setBusy(true);
    try {
      const invite = await createSignedInvitation({
        ownerKeys: deviceKeys,
        ownerName: session.userName,
        circleId: authority.circleId,
        circleName: authority.circleName,
        ttlMinutes: ttl,
        defaultGrantPeriod: grantPeriod,
        permissions: authority.defaultPermissions,
      });
      const next: EnrollmentSession = {
        ...session,
        authority: { ...authority, invitations: [{ invite, status: 'active' }, ...authority.invitations] },
      };
      await onUpdateSession(next);
      const loginName = username.trim() || makeUsername(recipientName);
      const temporaryPassword = password || makeTemporaryPassword();
      setUsername(loginName);
      setPassword(temporaryPassword);
      const nextCredentials: InviteCredentials = {
        v: 1,
        inviteToken: encodeBundleToken('LWINV1', invite),
        recipientName: recipientName.trim(),
        recipientAddress: recipientAddress.trim(),
        username: loginName,
        temporaryPassword,
        circleName: authority.circleName,
        createdAt: Date.now(),
        expiresAt: invite.expiresAt,
        osHint: recipientOs,
      };
      setCredentials(nextCredentials);
      setQr(await QRCode.toDataURL(encodeRecipientInviteUrl(nextCredentials), {
        width: 320, margin: 1, errorCorrectionLevel: 'M',
      }));
      onNotice('Secure invite link and QR ready — share them privately.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite link.');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!authority) return;
    const next: EnrollmentSession = {
      ...session,
      authority: {
        ...authority,
        usedInviteIds: authority.usedInviteIds.includes(inviteId)
          ? authority.usedInviteIds : [...authority.usedInviteIds, inviteId],
      },
    };
    await onUpdateSession(next);
    onNotice('Invite link revoked.');
  };

  const revokeMember = async (deviceId: string) => {
    if (!authority) return;
    const nextAuthority = revokeCircleDevice(authority, deviceId);
    await onUpdateSession({ ...session, authority: nextAuthority });
    await publishRevocationList(authority.circleId, nextAuthority.revokedDeviceIds);
    onNotice('Member access revoked.');
  };

  const link = credentials ? encodeRecipientInviteUrl(credentials) : '';
  const copy = async (value: string, label: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    onNotice(`${label} copied.`);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (!link || !credentials) return;
    const title = `Join ${circleName} on LeeWay Global P2P`;
    const text = `${credentials.recipientName}, open this link on your ${recipientOs} device, install the app, then sign in with ${credentials.username} / ${credentials.temporaryPassword}. You will be asked to change the password on first login. ${installInstructions(recipientOs)}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title, text, url: link });
        return;
      } catch { /* cancelled or unsupported: fall back to clipboard */ }
    }
    await copy(link, 'Invite link');
  };

  const encoded = encodeURIComponent(link || ' ');
  const shareText = credentials
    ? encodeURIComponent(`Join ${circleName}. Login: ${credentials.username} / ${credentials.temporaryPassword}. Install and open this link: `)
    : '';
  const targets = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${shareText}%20${encoded}`, icon: MessageCircle },
    { label: 'Telegram', href: `https://t.me/share/url?url=${encoded}&text=${shareText}`, icon: Send },
    { label: 'Email', href: `mailto:?subject=${encodeURIComponent(`Join ${circleName} on LeeWay Global P2P`)}&body=${shareText}%20${encoded}`, icon: Mail },
    { label: 'SMS', href: `sms:?&body=${shareText}%20${encoded}`, icon: Smartphone },
    { label: 'Other', href: `https://twitter.com/intent/tweet?text=${shareText}&url=${encoded}`, icon: Users },
  ];

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-[#0D1625]/80 p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">Create a room &amp; invite family</h2>
        <span className="text-[11px] font-mono-tabular text-amber-300">{circleName}</span>
      </div>

      {!isOwner ? (
        <p className="text-xs text-slate-400">
          You are a member of this circle. Ask the organizer for your personal invite link and login details.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Family member name
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Aunt Maya"
                className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Phone number or email
              <input value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="+1 555 0100 or maya@example.com"
                className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Their device
              <select value={recipientOs} onChange={(e) => setRecipientOs(e.target.value as OsFamily)}
                className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100">
                {OS_OPTIONS.map(([code, label]) => <option key={code} value={code} className="bg-[#0E131A]">{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Link expires
              <select value={ttl} onChange={(e) => setTtl(Number(e.target.value) as InviteTtlMinutes)}
                className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100">
                <option value={15} className="bg-[#0E131A]">15 minutes</option>
                <option value={60} className="bg-[#0E131A]">1 hour</option>
                <option value={1440} className="bg-[#0E131A]">24 hours</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Login name (optional)
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Generated from name"
                className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Temporary password (optional)
              <input value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Generated securely"
                className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={grantPeriod} onChange={(e) => setGrantPeriod(e.target.value as GrantPeriod)}
              className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100">
              <option value="6m" className="bg-[#0E131A]">6-month membership</option>
              <option value="1y" className="bg-[#0E131A]">1-year membership</option>
            </select>
            <button type="button" onClick={() => void makeInvite()} disabled={busy}
              className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50">
              {busy ? 'Creating…' : 'Create secure invite'}
            </button>
          </div>

          {error && <p className="text-xs text-rose-300">{error}</p>}

          {credentials && (
            <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Secure invite link"
                  className="min-w-0 flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2 font-mono-tabular text-[11px] text-slate-200" />
              </div>
              {qr && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                  <img src={qr} alt="Family invite QR code" className="h-28 w-28 rounded-lg bg-white p-1" />
                  <span className="text-[11px] text-slate-300">
                    Scan on the family member’s phone. The QR carries the same signed invite, login name and temporary password as the link.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono-tabular text-slate-300">
                <span>Login: {credentials.username}</span>
                <span>Temporary password: {credentials.temporaryPassword}</span>
                <span>To: {credentials.recipientAddress}</span>
                <span>Device: {credentials.osHint}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void share()}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2">
                  <Share2 className="w-4 h-4" aria-hidden="true" /> Share invite
                </button>
                <button type="button" onClick={() => void copy(link, 'Invite link')}
                  className="min-h-[42px] px-4 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-2">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                {targets.map(({ label, href, icon: Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer"
                    className="min-h-[42px] px-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    <Icon className="w-4 h-4" aria-hidden="true" /> {label}
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                {installInstructions(credentials.osHint)} The link carries the temporary login; send it privately. On first sign-in they must choose a new password before the room opens.
              </p>
            </div>
          )}

          <div className="border-t border-white/[0.07] pt-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300">Cross-device relay (optional)</span>
            <div className="flex flex-wrap gap-2">
              <input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)}
                placeholder="wss://your-relay.example"
                aria-label="WebSocket relay URL"
                className="min-w-0 flex-1 min-h-[40px] rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-slate-100" />
              <button type="button" onClick={() => {
                localStorage.setItem('lwp.relayUrl', relayUrl.trim());
                onNotice(relayUrl.trim() ? 'Relay saved — reload to connect.' : 'Relay cleared — messages queue locally.');
              }} className="min-h-[40px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-slate-100">
                Save relay
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Without a reachable relay, messages stay encrypted on this device until a link opens. Do not use localhost on a phone.</p>
          </div>

          <div className="border-t border-white/[0.07] pt-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300">Revoke access</span>
            {authority?.invitations.filter((i) => i.status === 'active' && !authority.usedInviteIds.includes(i.invite.inviteId)).map(({ invite }) => (
              <div key={invite.inviteId} className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="truncate">Invite {invite.inviteId.slice(0, 12)} · expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                <button type="button" onClick={() => void revokeInvite(invite.inviteId)}
                  className="min-h-[34px] px-2 rounded-lg bg-rose-500/15 text-rose-200 text-[11px] font-semibold">
                  Revoke link
                </button>
              </div>
            ))}
            {authority?.members.filter((m) => m.deviceId !== deviceKeys.deviceId).map((member) => (
              <div key={member.deviceId} className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="truncate">{member.name} · {member.role}</span>
                <button type="button" onClick={() => void revokeMember(member.deviceId)}
                  className="min-h-[34px] px-2 rounded-lg bg-rose-500/15 text-rose-200 text-[11px] font-semibold">
                  Revoke member
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
