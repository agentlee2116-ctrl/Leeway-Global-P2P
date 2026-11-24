/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.LOADING_SCREEN
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Full-screen black loading gate with the Creator medallion centered at ~60% of the viewport
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/LeeWayLoadingScreen.tsx
WHY: Restore the required branded boot experience before enrollment or any dispatch surface renders
HOW: Platform-independent CSS sizing (60vmin); no drive path, no external service, no simulated status
*/
import type { Translations } from '../utils/i18n';

export const LEEWAY_LARGE_LOGO_SRC = './assets/aistudio/leewaylargelogo.png';

export function LeeWayLoadingScreen({ t }: { t: Translations }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="leeway-loading"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        zIndex: 9999,
      }}
    >
      <img
        src={LEEWAY_LARGE_LOGO_SRC}
        alt="LeeWay Industries"
        draggable={false}
        style={{
          width: '60vmin',
          height: '60vmin',
          maxWidth: '60vw',
          maxHeight: '60vh',
          objectFit: 'contain',
          userSelect: 'none',
          animation: 'leeway-loading-breathe 2.4s ease-in-out infinite',
        }}
      />
      <div style={{ color: '#e2e8f0', textAlign: 'center', fontFamily: 'var(--font-display, sans-serif)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}>{t.appName}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
          Verifying device enrollment…
        </div>
      </div>
      <style>{`@keyframes leeway-loading-breathe { 0%,100%{opacity:.86;transform:scale(1)} 50%{opacity:1;transform:scale(1.02)} } @media (prefers-reduced-motion: reduce){ .leeway-loading img{animation:none} }`}</style>
    </div>
  );
}
