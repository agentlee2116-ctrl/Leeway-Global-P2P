/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.LEEWAYLOGO
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\LeeWayLogo.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/LeeWayLogo.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState } from 'react';

export const LEEWAY_LOGO_SRC = './assets/aistudio/leewaysmalllogo_698be64f.png';

interface LeeWayLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'crest';
  showWordmark?: boolean;
  wordmarkText?: string;
  subtitle?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-8 h-11 rounded-lg',
  md: 'w-10 h-14 rounded-xl',
  lg: 'w-14 h-20 rounded-2xl',
  crest: 'w-24 h-36 sm:w-28 sm:h-40 rounded-2xl',
} as const;

const TEXT_SIZE_MAP = {
  xs: 'text-xs',
  sm: 'text-sm sm:text-base',
  md: 'text-base sm:text-lg',
  lg: 'text-xl sm:text-2xl',
  crest: 'text-2xl sm:text-3xl',
} as const;

export function LeeWayLogo({
  size = 'sm',
  showWordmark = true,
  wordmarkText = 'LeeWay Global P2P',
  subtitle,
}: LeeWayLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isCrest = size === 'crest';

  return (
    <div className="inline-flex items-center gap-2.5 min-w-0 shrink-0">
      <div
        className={`${SIZE_MAP[size]} bg-[#12100E] border border-amber-500/30 shadow-[0_8px_22px_-8px_rgba(245,158,11,0.45)] flex items-center justify-center shrink-0 overflow-hidden relative`}
      >
        {!imgFailed ? (
          <img
            src={LEEWAY_LOGO_SRC}
            alt="LeeWay Industries logo"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={
              isCrest
                ? 'w-full h-full object-contain'
                : 'w-full h-full object-contain'
            }
          />
        ) : (
          <span role="status" className="px-0.5 text-center text-[8px] font-semibold text-amber-200">Logo unavailable</span>
        )}
      </div>

      {showWordmark && (
        <div className="min-w-0 flex flex-col">
          <span
            className={`font-display ${TEXT_SIZE_MAP[size]} font-bold tracking-tight text-slate-100 whitespace-nowrap leading-none`}
          >
            {wordmarkText}
          </span>
          {subtitle && (
            <span className="text-[11px] text-slate-400 whitespace-nowrap mt-1 leading-none">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
