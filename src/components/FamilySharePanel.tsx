/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.FAMILY_SHARE_PANEL
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Configure, generate and share a signed family invitation link on any OS or device
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/FamilySharePanel.tsx
WHY: After sign-in the organizer must immediately see a clear way to invite relatives
HOW: Web Share API with copy/share-target fallback; cross-platform responsive controls, no JSON download step
*/
import { useState } from 'react';
import {
  Check, Copy, Link2, Mail, MessageCircle, Send, Share2, Smartphone, Users,
} from 'lucide-react';
import type { Translations } from '../utils/i18n';
import type { EnrollmentSession } from '../utils/circleStore';
import { encodeBundleToken, encodeInviteShareUrl } from '../utils/circleStore';
import { createSignedInvitation, type DeviceKeyRecord } from '../utils/enrollmentCrypto';
import type { InviteTtlMinutes, GrantPeriod } from '../utils/enrollmentCrypto';

interface Props {
  t: Translations;
  session: EnrollmentSession;
  deviceKeys: DeviceKeyRecord;
  onUpdateSession: (session: EnrollmentSession) => Promise<void>;
  onNotice: (message: string) => void;
}

export function FamilySharePanel({ t, session, deviceKeys, onUpdateSession, onNotice }: Props) {
  const [ttl, setTtl] = useState<InviteTtlMinutes>(1440);
  const [grantPeriod, setGrantPeriod] = useState<GrantPeriod>('1y');
  const [link, setLink] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authority = session.authority;
  const circleName = authority?.circleName ?? session.circleName;
  const isOwner = session.role === 'owner';

  const makeInvite = async () => {
    setError(null);
    if (!authority || !isOwner) {
      setError('Ask the circle organizer for an invite link.');
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
      setLink(encodeInviteShareUrl(invite));
      setToken(encodeBundleToken('LWINV1', invite));
      onNotice('Invite link ready — share it with your family.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    onNotice(`${label} copied.`);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (!link) return;
    const title = `Join ${circleName} on LeeWay Global P2P`;
    const text = 'Install LeeWay Global P2P from this link, open the invitation, then join our private family circle.';
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title, text, url: link });
        return;
      } catch { /* user cancelled or share sheet unavailable: fall back below */ }
    }
    await copy(link, 'Invite link');
  };

  const encoded = encodeURIComponent(link || ' ');
  const message = encodeURIComponent(`Join ${circleName} on LeeWay Global P2P. Install from the link and open the invitation.`);
  const targets = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${message}%20${encoded}`, icon: MessageCircle },
    { label: 'Telegram', href: `https://t.me/share/url?url=${encoded}&text=${message}`, icon: Send },
    { label: 'Email', href: `mailto:?subject=${encodeURIComponent(titleFor(circleName))}&body=${message}%20${encoded}`, icon: Mail },
    { label: 'SMS', href: `sms:?&body=${message}%20${encoded}`, icon: Smartphone },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${message}&url=${encoded}`, icon: Users },
  ];

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-[#0D1625]/80 p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">Invite your family</h2>
        <span className="text-[11px] font-mono-tabular text-amber-300">{circleName}</span>
      </div>

      {!isOwner ? (
        <p className="text-xs text-slate-400">
          You are a member of this circle. Ask the organizer for an invite link, then paste it into the join screen.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-400" htmlFor="family-invite-ttl">Link expires</label>
            <select id="family-invite-ttl" value={ttl}
              onChange={(e) => setTtl(Number(e.target.value) as InviteTtlMinutes)}
              className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100">
              <option value={15} className="bg-[#0E131A]">15 minutes</option>
              <option value={60} className="bg-[#0E131A]">1 hour</option>
              <option value={1440} className="bg-[#0E131A]">24 hours</option>
            </select>
            <label className="text-xs text-slate-400" htmlFor="family-invite-grant">Membership</label>
            <select id="family-invite-grant" value={grantPeriod}
              onChange={(e) => setGrantPeriod(e.target.value as GrantPeriod)}
              className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100">
              <option value="6m" className="bg-[#0E131A]">6 months</option>
              <option value="1y" className="bg-[#0E131A]">1 year</option>
            </select>
            <button type="button" onClick={() => void makeInvite()} disabled={busy}
              className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50">
              {busy ? 'Creating…' : 'Create invite link'}
            </button>
          </div>

          {error && <p className="text-xs text-rose-300">{error}</p>}

          {link && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                <input readOnly value={link} onFocus={(e) => e.target.select()}
                  aria-label="Invite link"
                  className="min-w-0 flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2 font-mono-tabular text-[11px] text-slate-200" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void share()}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2">
                  <Share2 className="w-4 h-4" aria-hidden="true" /> Share invite
                </button>
                <button type="button" onClick={() => void copy(link, 'Invite link')}
                  className="min-h-[42px] px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-2">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                {targets.map(({ label, href, icon: Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer"
                    className="min-h-[42px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    <Icon className="w-4 h-4" aria-hidden="true" /> {label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={token} onFocus={(e) => e.target.select()}
                  aria-label="Invite code"
                  className="min-w-0 flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2 font-mono-tabular text-[11px] text-slate-400" />
                <button type="button" onClick={() => void copy(token, 'Invite code')}
                  className="min-h-[40px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-slate-100">
                  Copy code
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Share the link by any app or message. Relatives open it on iPhone, Android, Windows, Mac or Linux, install the PWA or app, and paste the invite to join. The code is a backup if links are blocked.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function titleFor(circleName: string): string {
  return `Join ${circleName} on LeeWay Global P2P`;
}
