/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.LANGUAGEDROPDOWN
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\LanguageDropdown.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/LanguageDropdown.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { ChevronDown, Globe } from 'lucide-react';
import { LANGUAGE_LIST, type LangCode } from '../utils/i18n';

interface LanguageDropdownProps {
  id: string;
  label: string;
  value: LangCode;
  onChange: (lang: LangCode) => void;
  variant?: 'full' | 'compact';
}

export function LanguageDropdown({
  id,
  label,
  value,
  onChange,
  variant = 'full',
}: LanguageDropdownProps) {
  const activeOption =
    LANGUAGE_LIST.find((item) => item.code === value) ?? LANGUAGE_LIST[0];

  if (variant === 'compact') {
    return (
      <div className="relative flex items-center gap-1 bg-white/[0.04] hover:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400 border border-white/[0.08] rounded-xl px-2.5 min-h-[40px] shrink-0 transition-colors">
        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="text-xs font-semibold text-slate-100 whitespace-nowrap select-none pointer-events-none"
        >
          {activeOption.shortCode}
        </span>
        <ChevronDown
          className="w-3 h-3 text-slate-400 shrink-0 pointer-events-none"
          aria-hidden="true"
        />
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as LangCode)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          {LANGUAGE_LIST.map((item) => (
            <option key={item.code} value={item.code} className="bg-[#0E131A] text-slate-100">
              {item.shortCode} · {item.nativeName} — {item.englishName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="relative flex items-center w-full">
      <Globe
        className="w-4 h-4 text-amber-400 absolute left-3.5 rtl:left-auto rtl:right-3.5 pointer-events-none shrink-0"
        aria-hidden="true"
      />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as LangCode)}
        className="w-full min-h-[48px] appearance-none rounded-2xl bg-[#080B0F] hover:bg-white/[0.03] border border-white/[0.12] focus:border-amber-400 pl-10 pr-10 rtl:pl-10 rtl:pr-10 text-sm font-semibold text-slate-100 cursor-pointer transition-colors focus:outline-none"
      >
        {LANGUAGE_LIST.map((item) => (
          <option key={item.code} value={item.code} className="bg-[#0E131A] text-slate-100">
            {item.nativeName} — {item.englishName} ({item.shortCode})
          </option>
        ))}
      </select>
      <ChevronDown
        className="w-4 h-4 text-slate-400 absolute right-3.5 rtl:right-auto rtl:left-3.5 pointer-events-none shrink-0"
        aria-hidden="true"
      />
    </div>
  );
}
