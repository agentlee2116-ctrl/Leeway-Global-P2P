/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.INSTALL_BUTTON
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Install/download control shown before enrollment on every supported OS
WHEN: 2026-11-25
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/InstallButton.tsx
WHY: A first-time visitor must be able to install the app before joining a family circle
HOW: Native beforeinstallprompt where supported, Safari Add-to-Home-Screen guidance on iOS, signed APK fallback for Android; hidden once running as installed app
*/
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const APK_URL = 'https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/downloads/leeway-global-p2p-v1.0.0-release.apk';
const PAGES_URL = 'https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [installed, setInstalled] = useState(isStandalone());
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onChange = () => setInstalled(isStandalone());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onChange);
    const media = window.matchMedia?.('(display-mode: standalone)');
    media?.addEventListener?.('change', onChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onChange);
      media?.removeEventListener?.('change', onChange);
    };
  }, []);

  if (installed) return null;

  const handle = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    if (isIos()) { setShowIosHelp(true); return; }
    window.open(APK_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={() => void handle()}
          className={`inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 text-xs font-bold ${compact ? 'px-3' : 'px-4 py-2'}`}>
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          Get LeeWay on this device
        </button>
        {!compact && (
          <button type="button" onClick={() => window.open(PAGES_URL, '_blank', 'noopener,noreferrer')}
            className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-200">
            Install instructions &amp; signed Android APK
          </button>
        )}
      </div>
      {showIosHelp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0D1625] p-5" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-100">Install on iPhone</h2>
              <button type="button" onClick={() => setShowIosHelp(false)} aria-label="Close" className="min-h-[40px] px-2 text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-slate-300">
              <li>Tap the Safari Share button.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>. Open the new home-screen icon.</li>
            </ol>
            <p className="mt-3 text-[11px] text-slate-400">iOS requires this manual step; Apple does not allow web apps to trigger installation directly.</p>
          </div>
        </div>
      )}
    </>
  );
}
