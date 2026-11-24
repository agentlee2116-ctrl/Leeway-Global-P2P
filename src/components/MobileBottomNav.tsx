/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.MOBILEBOTTOMNAV
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\MobileBottomNav.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/MobileBottomNav.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { Film, MessageSquare, Radio, Users } from 'lucide-react';
import type { Translations } from '../utils/i18n';

export type MobileTab = 'talk' | 'snaps' | 'messages' | 'circle';

interface MobileBottomNavProps {
  t: Translations;
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  unreadSnapsCount: number;
  unreadTextsCount: number;
}

export function MobileBottomNav({
  t,
  activeTab,
  onSelectTab,
  unreadSnapsCount,
  unreadTextsCount,
}: MobileBottomNavProps) {
  const tabs: {
    id: MobileTab;
    label: string;
    icon: typeof Radio;
    count?: number;
  }[] = [
    { id: 'talk', label: t.navTalk, icon: Radio },
    { id: 'snaps', label: t.navSnaps, icon: Film, count: unreadSnapsCount },
    { id: 'messages', label: t.navMessages, icon: MessageSquare, count: unreadTextsCount },
    { id: 'circle', label: t.navCircle, icon: Users },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#080B0F]/90 backdrop-blur-xl border-t border-white/[0.07]"
    >
      <div className="grid grid-cols-4 h-full max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
                active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 inset-x-6 h-[2px] rounded-full bg-amber-400"
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.75} aria-hidden="true" />
              {typeof tab.count === 'number' && tab.count > 0 && !active && (
                <span className="sr-only">({tab.count})</span>
              )}
              <span className="text-[11px] font-medium tracking-tight leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
