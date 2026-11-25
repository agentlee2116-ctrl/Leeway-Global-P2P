/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.ONBOARDINGWELCOME
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\OnboardingWelcome.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/OnboardingWelcome.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  ShieldPlus,
  Upload,
  Users,
} from 'lucide-react';
import {
  restoreFromRecoveryKit,
  type EncryptedRecoveryKit,
} from '../utils/enrollmentCrypto';
import type { LangCode, Translations } from '../utils/i18n';
import { LanguageDropdown } from './LanguageDropdown';
import { InstallButton } from './InstallButton';

interface OnboardingWelcomeProps {
  t: Translations;
  lang: LangCode;
  onChangeLang: (lang: LangCode) => void;
  onStartOwnerSetup: () => void;
  onStartMemberJoin: () => void;
  lockReason?: string | null;
  onResetLockedDevice?: () => void;
}

export function OnboardingWelcome({
  t,
  lang,
  onChangeLang,
  onStartOwnerSetup,
  onStartMemberJoin,
  lockReason,
  onResetLockedDevice,
}: OnboardingWelcomeProps) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [kitJson, setKitJson] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoredInfo, setRestoredInfo] = useState<{
    circleId: string;
    circleName: string;
    ownerName: string;
    previousFingerprint: string;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleUploadKitFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setKitJson(text);
      setRestoreError(null);
    } catch {
      setRestoreError('Could not read the selected backup file.');
    }
  };

  const handleRestoreSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRestoreError(null);
    setRestoredInfo(null);
    if (!kitJson.trim()) {
      setRestoreError('Paste or upload your encrypted recovery kit first.');
      return;
    }
    if (!passphrase.trim()) {
      setRestoreError('Enter your recovery kit passphrase.');
      return;
    }
    setRestoring(true);
    try {
      const parsed = JSON.parse(kitJson) as EncryptedRecoveryKit;
      const result = await restoreFromRecoveryKit(parsed, passphrase);
      setRestoredInfo(result);
    } catch {
      setRestoreError('Wrong passphrase or invalid recovery kit file.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#080B0F] bg-[radial-gradient(ellipse_85%_50%_at_50%_-10%,rgba(245,158,11,0.08),transparent)] text-slate-100 flex flex-col">
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-12 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch">
          {/* Left / Brand & Gate Context */}
          <section className="lg:col-span-5 flex flex-col justify-between gap-6 py-2">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <ShieldCheck className="w-9 h-9 text-amber-400 shrink-0" aria-hidden="true" />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono-tabular text-[11px] sm:text-xs font-semibold tracking-wide text-amber-300">
                      LeeWay Standards · Zero API Keys
                    </span>
                    <span className="text-xs text-slate-400">
                      Private Family Enrollment Gate
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
                    {t.appName}
                  </h1>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
                    {t.welcomeTagline}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0C1016] aspect-[16/10] relative">
                <img
                  src="./src/assets/images/family_dinner_snap_1795518768888.jpg"
                  alt="Family gathering connected over a private encrypted line"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-85"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#080B0F] via-[#080B0F]/35 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 flex items-center gap-2.5 text-xs text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>
                    Messages, voice, and video stay locked until this device is verified and approved.
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex flex-col gap-2 pt-4 border-t border-white/[0.06] text-xs text-slate-400 leading-relaxed">
              <div className="text-slate-200 font-semibold">Protected Before First Message</div>
              <p>
                Every phone generates non-extractable Web Crypto keys on-device with no API keys
                or central accounts, requiring an owner-signed grant before joining.
              </p>
            </div>
          </section>

          {/* Right / Primary Onboarding Card */}
          <section
            aria-label="Choose enrollment path"
            className="lg:col-span-7 rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] p-5 sm:p-7 flex flex-col justify-between gap-6"
          >
            <div className="flex flex-col gap-5">
              {lockReason && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-400/30 flex flex-col gap-2.5"
                >
                  <div className="flex items-start gap-2.5 text-sm font-semibold text-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Secure line locked</span>
                  </div>
                  <p className="text-xs text-red-200/90 leading-relaxed">{lockReason}</p>
                  {onResetLockedDevice && (
                    <div>
                      <button
                        type="button"
                        onClick={onResetLockedDevice}
                        className="min-h-[40px] px-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-xs font-semibold text-red-100 cursor-pointer"
                      >
                        Clear locked session & re-enroll
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Language Selector */}
              <div className="flex flex-col gap-2 pb-4 border-b border-white/[0.06]">
                <span className="text-xs font-medium text-slate-300">
                  {t.welcomeSelectLang}
                </span>
                <LanguageDropdown
                  id="welcome-lang-select"
                  label={t.langLabel}
                  value={lang}
                  onChange={onChangeLang}
                  variant="full"
                />
              </div>

              <InstallButton />

              {/* Dual-Path Choices */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onStartOwnerSetup}
                  className="group w-full min-h-[76px] p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-between gap-4 text-left transition-all active:scale-[0.99] cursor-pointer shadow-[0_14px_30px_-10px_rgba(245,158,11,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-950/15 flex items-center justify-center shrink-0">
                      <ShieldPlus className="w-5 h-5 text-slate-950" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base sm:text-lg font-bold leading-snug">
                        {t.createPrivateLine}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-slate-900/80 mt-0.5">
                        {t.createPrivateLineSub}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-5 h-5 text-slate-950 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={onStartMemberJoin}
                  className="group w-full min-h-[76px] p-4 sm:p-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-100 flex items-center justify-between gap-4 text-left transition-all active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/20 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-sky-300" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base sm:text-lg font-bold leading-snug">
                        {t.joinMyFamily}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        {t.joinMyFamilySub}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-5 h-5 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {/* Encrypted Recovery Restoration Drawer */}
            <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setRestoreOpen((v) => !v)}
                aria-expanded={restoreOpen}
                className="min-h-[44px] text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-2 self-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg px-1"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <span>{t.restoreDeviceLink}</span>
              </button>

              {restoreOpen && (
                <form
                  onSubmit={handleRestoreSubmit}
                  className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Decrypt Recovery Kit
                    </span>
                    <label className="min-h-[36px] px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Load .json</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleUploadKitFile}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  <label htmlFor="recovery-kit-json" className="sr-only">
                    Recovery Kit JSON
                  </label>
                  <textarea
                    id="recovery-kit-json"
                    rows={3}
                    value={kitJson}
                    onChange={(e) => setKitJson(e.target.value)}
                    placeholder="Paste your encrypted recovery kit JSON..."
                    className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50"
                  />

                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="recovery-kit-pass" className="sr-only">
                      {t.recoveryPassphraseLabel}
                    </label>
                    <input
                      id="recovery-kit-pass"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder={t.recoveryPassphraseLabel}
                      className="flex-1 min-h-[44px] rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50"
                    />
                    <button
                      type="submit"
                      disabled={restoring}
                      className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {restoring ? 'Unlocking...' : 'Inspect Kit'}
                    </button>
                  </div>

                  {restoreError && (
                    <p role="alert" className="text-xs text-red-400">
                      {restoreError}
                    </p>
                  )}

                  {restoredInfo && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/25 text-xs text-emerald-100 flex flex-col gap-2">
                      <div className="font-semibold">
                        Verified backup for {restoredInfo.circleName} ({restoredInfo.circleId})
                      </div>
                      <p className="text-emerald-200/85 leading-relaxed">
                        Lost devices never reuse old private keys. Start a fresh setup or ask a
                        circle device to authorize your replacement device ({restoredInfo.ownerName}).
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={onStartMemberJoin}
                          className="min-h-[38px] px-3 rounded-lg bg-emerald-500 text-slate-950 font-semibold cursor-pointer"
                        >
                          Re-enroll via Invitation
                        </button>
                        <button
                          type="button"
                          onClick={onStartOwnerSetup}
                          className="min-h-[38px] px-3 rounded-lg bg-white/10 text-white font-semibold cursor-pointer"
                        >
                          Establish Replacement Circle
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
