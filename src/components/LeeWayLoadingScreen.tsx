/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.LOADING_SCREEN
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Startup screen displaying the Creator-provided original full LeeWay Industries logo
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/LeeWayLoadingScreen.tsx
WHY: Honor original LeeWay identity throughout the secure startup and enrollment check
HOW: Use the exact uploaded full PNG; dynamic indeterminate loading status linked to actual startup, not a simulated progress percentage
LICENSE: Preserve original repository terms; logo rights are not newly asserted
*/
import type { Translations } from '../utils/i18n';

/** Exact, unmodified Creator-provided full LeeWay Industries logo. */
export const LEEWAY_LARGE_LOGO_SRC = './assets/aistudio/leewaylargelogo.png';

export function LeeWayLoadingScreen({ t }: { t: Translations }) {
  return (
    <main role="status" aria-live="polite" aria-label="Verifying device enrollment"
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto bg-[#050505] px-4 py-6 text-center text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(74,55,27,0.10),transparent_66%)]" />
      <img src={LEEWAY_LARGE_LOGO_SRC} alt="LeeWay Industries — full original logo"
        draggable={false} className="relative z-10 block max-h-[72dvh] max-w-[min(78vw,600px)] object-contain"
        style={{ height: 'min(62vmin, 620px)', width: 'auto' }} />
      <div className="relative z-10 mt-4 w-full max-w-md">
        <div className="font-display text-lg font-semibold tracking-wide text-amber-200">{t.appName}</div>
        <p className="mt-2 text-sm text-slate-300">Verifying device enrollment…</p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-amber-900/50" aria-hidden="true">
          <div className="leeway-auth-indeterminate h-full w-1/3 rounded-full bg-amber-400" />
        </div>
        <span className="sr-only">Waiting for verified device enrollment to complete.</span>
      </div>
      <style>{`@keyframes leeway-auth-sweep { from{transform:translateX(-110%)} to{transform:translateX(410%)} }
        .leeway-auth-indeterminate{animation:leeway-auth-sweep 1.9s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.leeway-auth-indeterminate{animation:none;width:100%;opacity:.55}}`}</style>
    </main>
  );
}
