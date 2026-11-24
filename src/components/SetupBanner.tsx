/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.SETUPBANNER
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\SetupBanner.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/SetupBanner.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { Check, KeyRound } from 'lucide-react';
import type { Translations } from '../utils/i18n';

interface SetupBannerProps {
  t: Translations;
  onOpenSetup: () => void;
  onDismiss: () => void;
}

export function SetupBanner({ t, onOpenSetup, onDismiss }: SetupBannerProps) {
  return (
    <section
      aria-label={t.setupTitle}
      className="rounded-2xl bg-[#0E131A]/90 border border-white/[0.07] px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xs sm:text-sm font-semibold text-slate-100 leading-tight">
            {t.setupTitle}
          </h2>
          <p className="hidden sm:block text-xs text-slate-400 mt-0.5 leading-snug">
            {t.setupDesc}
          </p>
          <p className="sm:hidden text-[11px] text-slate-400 mt-0.5 leading-snug">
            Invites, pending approvals & active devices
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenSetup}
          className="min-h-[40px] sm:min-h-[44px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {t.setupBtn}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss setup banner"
          className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Check className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
