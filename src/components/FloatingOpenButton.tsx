/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.FLOATING_OPEN_BUTTON
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Persistent gold lock-and-eye Open LeeWay button available on every screen and install path
WHEN: 2026-11-25
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/FloatingOpenButton.tsx
WHY: The user must always have one visible control that opens the app on a phone, tablet or desktop
HOW: Fixed-position button using the Creator icon; opens the hosted app or reloads the installed PWA; no native-only behaviour
*/
export const OPEN_ICON_SRC = './assets/aistudio/leeway-open-app-icon.png';
const APP_URL = 'https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/app/';

export function FloatingOpenButton() {
  const open = () => {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      window.location.reload();
      return;
    }
    window.open(APP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open LeeWay Global Family Connect"
      title="Open LeeWay"
      className="leeway-open-fab"
    >
      <img src={OPEN_ICON_SRC} alt="LeeWay" draggable={false} />
      <span>Open LeeWay</span>
    </button>
  );
}
