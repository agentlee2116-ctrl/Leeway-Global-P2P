/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CIRCLEMOBILEPANEL
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\CircleMobilePanel.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/CircleMobilePanel.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { Lock, Shield, ShieldCheck, Video } from 'lucide-react';
import type { EnrollmentSession } from '../utils/circleStore';
import type { Translations } from '../utils/i18n';
import { Avatar } from './Avatar';

interface CircleMobilePanelProps {
  t: Translations;
  session: EnrollmentSession;
  pendingApprovalsCount: number;
  onOpenSecurity: () => void;
  onOpenVideoRoom: () => void;
}

export function CircleMobilePanel({
  t,
  session,
  pendingApprovalsCount,
  onOpenSecurity,
  onOpenVideoRoom,
}: CircleMobilePanelProps) {
  const isOwner = session.role === 'owner';

  return (
    <section
      aria-label={t.navCircle}
      className="rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-4 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            name={session.userName}
            src="./src/assets/images/avatar_leonard_1795518769606.jpg"
            size="md"
          />
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold tracking-tight text-slate-100 truncate">
              {session.userName}
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {session.circleName} · {isOwner ? t.ownerRoleBadge : t.memberRoleBadge}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSecurity}
          className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Shield className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>
            {isOwner ? t.securityDashboardBtn : t.deviceStatusBtn}
            {isOwner && pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ''}
          </span>
        </button>
      </div>

      {session.grant.permissions.videoRoom && (
        <button
          type="button"
          onClick={onOpenVideoRoom}
          className="w-full min-h-[56px] p-4 rounded-2xl bg-sky-500/12 hover:bg-sky-500/18 border border-sky-400/25 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Video className="w-5 h-5 text-sky-300 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-sky-100 truncate">
                {t.videoRoom}
              </div>
              <div className="text-xs text-sky-200/80 truncate">{t.roomStandby}</div>
            </div>
          </div>
          <span className="text-xs font-semibold text-sky-200 shrink-0">{t.openSnap}</span>
        </button>
      )}

      <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.07] flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">{t.circleIdLabel}</span>
          <span className="font-mono-tabular font-semibold text-amber-300">{session.circleId}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Device Lock</span>
          <span className="text-emerald-300 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Protected
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Membership Grant</span>
          <span className="text-slate-200">
            Valid until {new Date(session.grant.expiresAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          {t.appName} · Zero API keys · On-device Web Crypto
        </span>
      </div>
    </section>
  );
}
