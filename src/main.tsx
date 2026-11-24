/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.MAIN
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\main.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/main.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerPwaUpdates } from './pwa-updates.ts';

createRoot(document.getElementById('root')!).render(<App />);

/* PWA update detection stays outside the UI layer so the UI remains portable. */
void registerPwaUpdates(() => {});
