/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TOPBAR
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\TopBar.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/TopBar.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { ShieldCheck, Shield, Video, Wifi, WifiOff } from 'lucide-react';
import type { LangCode, Translations } from '../utils/i18n';
import { LanguageDropdown } from './LanguageDropdown';
import { LeeWayLogo } from './LeeWayLogo';

interface TopBarProps {
  t: Translations;
  lang: LangCode;
  onChangeLang: (lang: LangCode) => void;
  offline: boolean;
  queuedCount: number;
  onToggleOffline: () => void;
  circleId: string;
  circleName: string;
  role: 'owner' | 'member';
  pendingApprovalsCount: number;
  canVideoRoom: boolean;
  onOpenSecurity: () => void;
  onOpenVideoRoom: () => void;
}

export function TopBar({
  t,
  lang,
  onChangeLang,
  offline,
  queuedCount,
  onToggleOffline,
  circleId,
  circleName,
  role,
  pendingApprovalsCount,
  canVideoRoom,
  onOpenSecurity,
  onOpenVideoRoom,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-[#080B0F]/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 md:gap-8">
        {/* Zone 1: LeeWay Brand Logo & Single-Line Wordmark */}
        <div className="flex items-center min-w-0 shrink">
          <LeeWayLogo size="sm" showWordmark wordmarkText={t.appName} />
        </div>

        {/* Zone 2 (Desktop): Active Authorized Circle & Connection Mode */}
        <div className="hidden md:flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-slate-100">{circleName}</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="font-mono-tabular text-slate-400">{circleId}</span>
          </div>

          <span className="text-white/10 select-none" aria-hidden="true">
            /
          </span>

          <button
            type="button"
            onClick={onToggleOffline}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              offline
                ? 'bg-amber-500/12 border-amber-500/35 text-amber-200'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.07]'
            }`}
          >
            {offline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            )}
            <span>
              {offline ? t.queuedOffline : t.allGood}
              {queuedCount > 0 ? ` (${queuedCount})` : ''}
            </span>
          </button>
        </div>

        {/* Zone 3: Security/Device Action + Video Room + Language */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleOffline}
            aria-label={offline ? t.queuedOffline : t.allGood}
            className={`md:hidden min-h-[40px] px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              offline
                ? 'bg-amber-500/12 border-amber-500/35 text-amber-200'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
            }`}
          >
            {offline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            )}
            <span>{offline ? t.queuedTag : t.allGood}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSecurity}
            className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              {role === 'owner' ? t.securityDashboardBtn : t.deviceStatusBtn}
              {role === 'owner' && pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ''}
            </span>
          </button>

          {canVideoRoom && (
            <button
              type="button"
              onClick={onOpenVideoRoom}
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-500/12 hover:bg-sky-500/20 border border-sky-400/25 text-sky-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Video className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{t.videoRoom}</span>
            </button>
          )}

          <LanguageDropdown
            id="lang-select"
            label={t.langLabel}
            value={lang}
            onChange={onChangeLang}
            variant="compact"
          />
        </div>
      </div>
    </header>
  );
}
