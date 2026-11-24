/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.PWA_UPDATES
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Service worker update detection and one-tap refresh that preserves offline queue
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/pwa-updates.ts
WHY: New builds must install smoothly without discarding unsent encrypted dispatches
HOW: Waiting-worker detection, explicit skipWaiting on user action, one controller-change reload; queue lives in IndexedDB and is never cleared
*/
export type UpdateState = 'checking' | 'available' | 'active' | 'unavailable';

/** Pure decision helper, testable without a browser. */
export function isUpdateActionable(state: UpdateState, online: boolean): boolean {
  return state === 'available' && online;
}

export interface PwaUpdateHandle {
  applyUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

export async function registerPwaUpdates(onChange: (state: UpdateState) => void): Promise<PwaUpdateHandle> {
  const sw = (navigator as any)?.serviceWorker;
  if (!sw || !import.meta.env.PROD) {
    onChange('unavailable');
    return { applyUpdate: async () => {}, checkForUpdates: async () => {} };
  }

  let waitingWorker: ServiceWorker | null = null;
  let reloading = false;

  const registration: ServiceWorkerRegistration = await sw.register('./sw.js');
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    onChange('checking');
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = installing;
        onChange('available');
      }
    });
  });

  // Periodic check while the app is open and online.
  const timer = setInterval(() => {
    if (navigator.onLine) void registration.update();
  }, 60 * 60 * 1000);
  if (import.meta.hot) import.meta.hot.dispose(() => clearInterval(timer));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    // IndexedDB queue survives the reload; no store.clear() is ever called here.
    window.location.reload();
  });

  void registration.update();

  return {
    applyUpdate: async () => {
      if (!waitingWorker) return;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    },
    checkForUpdates: async () => { if (navigator.onLine) await registration.update(); },
  };
}
