/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.MEMBERONBOARDINGFLOW
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\MemberOnboardingFlow.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/MemberOnboardingFlow.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  clearPendingMemberEnrollment,
  downloadJsonFile,
  encodeBundleToken,
  loadRelayMembershipGrant,
  parseBundleInput,
  pushRelayJoinRequest,
  saveEnrollmentSession,
  savePendingMemberEnrollment,
  subscribeSyncEvents,
  type EnrollmentSession,
  type PendingMemberEnrollment,
} from '../utils/circleStore';
import {
  createJoinRequest,
  generateProtectedDeviceKeys,
  loadDeviceKeysProtected,
  verifyInvitation,
  verifyMembershipGrant,
  type DeviceKeyRecord,
  type SignedInvitation,
  type SignedMembershipGrant,
} from '../utils/enrollmentCrypto';
import type { LangCode, Translations } from '../utils/i18n';
import { LanguageDropdown } from './LanguageDropdown';
import { InstallButton } from './InstallButton';

interface MemberOnboardingFlowProps {
  t: Translations;
  lang: LangCode;
  onChangeLang: (lang: LangCode) => void;
  initialPending?: PendingMemberEnrollment | null;
  initialInviteParam?: string | null;
  onBack: () => void;
  onUnlocked: (session: EnrollmentSession, keys: DeviceKeyRecord) => void;
}

export function MemberOnboardingFlow({
  t,
  lang,
  onChangeLang,
  initialPending,
  initialInviteParam,
  onBack,
  onUnlocked,
}: MemberOnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialPending ? 3 : 1);

  // Step 1: Invitation verification
  const [inviteRaw, setInviteRaw] = useState(initialInviteParam ?? '');
  const [verifiedInvite, setVerifiedInvite] = useState<SignedInvitation | null>(
    initialPending?.invite ?? null
  );
  const [verifyingInvite, setVerifyingInvite] = useState(false);

  // Step 2: Language, Name & Device Lock
  const [memberName, setMemberName] = useState(initialPending?.memberName ?? '');
  const [deviceLockEnabled, setDeviceLockEnabled] = useState(
    initialPending?.deviceLockEnabled ?? false
  );
  const [preparingDevice, setPreparingDevice] = useState(false);

  // Step 3: Waiting for Owner Approval
  const [pending, setPending] = useState<PendingMemberEnrollment | null>(initialPending ?? null);
  const [grantInput, setGrantInput] = useState('');
  const [copiedReq, setCopiedReq] = useState(false);
  const [verifyingGrant, setVerifyingGrant] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const tryFinalizeGrant = async (
    grant: SignedMembershipGrant,
    activePending: PendingMemberEnrollment
  ) => {
    const keys = await loadDeviceKeysProtected(activePending.memberDeviceId);
    if (!keys) {
      setError('Protected keys on this device could not be loaded.');
      return false;
    }

    const check = await verifyMembershipGrant(grant, {
      expectedDeviceId: activePending.memberDeviceId,
      expectedOwnerFingerprint: activePending.invite.issuerFingerprint,
    });

    if (!check.ok) {
      setError(check.reason);
      return false;
    }

    const session: EnrollmentSession = {
      version: 1,
      deviceId: activePending.memberDeviceId,
      role: 'member',
      userName: activePending.memberName,
      circleId: grant.circleId,
      circleName: grant.circleName,
      deviceLockEnabled: true,
      grant,
      enrolledAt: Date.now(),
    };

    await clearPendingMemberEnrollment();
    await saveEnrollmentSession(session);
    onUnlocked(session, keys);
    return true;
  };

  // Auto-listen for owner approval on relay / BroadcastChannel while on Step 3
  useEffect(() => {
    if (step !== 3 || !pending) return;

    let cancelled = false;

    const checkMailbox = async () => {
      const existing = await loadRelayMembershipGrant(pending.memberDeviceId);
      if (!cancelled && existing) {
        await tryFinalizeGrant(existing, pending);
      }
    };
    void checkMailbox();

    const unsubscribe = subscribeSyncEvents((msg) => {
      if (
        msg.type === 'MEMBERSHIP_GRANT' &&
        msg.memberDeviceId === pending.memberDeviceId
      ) {
        void tryFinalizeGrant(msg.grant, pending);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [step, pending]);

  const handleUploadInviteFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setInviteRaw(text);
      setError(null);
    } catch {
      setError('Could not read the selected invitation file.');
    }
  };

  const handleVerifyInvite = async () => {
    setError(null);
    const parsed = parseBundleInput<SignedInvitation>(inviteRaw, 'LWINV1');
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setVerifyingInvite(true);
    try {
      const check = await verifyInvitation(parsed.data);
      if (!check.ok) {
        setError(check.reason);
        setVerifiedInvite(null);
        return;
      }
      setVerifiedInvite(parsed.data);
      setStep(2);
    } finally {
      setVerifyingInvite(false);
    }
  };

  const handlePrepareDeviceAndRequest = async () => {
    if (!verifiedInvite) return;
    setError(null);
    const cleanName = memberName.trim();
    if (cleanName.length < 2) {
      setError('Please enter your preferred name (at least 2 characters).');
      return;
    }
    if (!deviceLockEnabled) {
      setError('Please enable device screen lock or biometrics before continuing.');
      return;
    }

    setPreparingDevice(true);
    try {
      const keys = await generateProtectedDeviceKeys();
      const joinRequest = await createJoinRequest({
        memberKeys: keys,
        memberName: cleanName,
        invite: verifiedInvite,
      });

      const nextPending: PendingMemberEnrollment = {
        version: 1,
        invite: verifiedInvite,
        memberDeviceId: keys.deviceId,
        memberName: cleanName,
        deviceLockEnabled: true,
        joinRequest,
        safetyCode: joinRequest.safetyCode,
        createdAt: Date.now(),
      };

      await savePendingMemberEnrollment(nextPending);
      await pushRelayJoinRequest(joinRequest);
      setPending(nextPending);
      setStep(3);
    } catch {
      setError('Could not prepare your device. Please try again.');
    } finally {
      setPreparingDevice(false);
    }
  };

  const handleUploadGrantFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setGrantInput(text);
      setError(null);
    } catch {
      setError('Could not read the approval file.');
    }
  };

  const handleVerifyGrantInput = async () => {
    if (!pending) return;
    setError(null);
    const parsed = parseBundleInput<SignedMembershipGrant>(grantInput, 'LWGRT1');
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setVerifyingGrant(true);
    try {
      await tryFinalizeGrant(parsed.data, pending);
    } finally {
      setVerifyingGrant(false);
    }
  };

  const handleCancelPending = async () => {
    await clearPendingMemberEnrollment();
    setPending(null);
    setVerifiedInvite(null);
    setStep(1);
    onBack();
  };

  const requestToken = pending ? encodeBundleToken('LWREQ1', pending.joinRequest) : '';

  return (
    <div className="min-h-[100dvh] bg-[#080B0F] bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(56,189,248,0.07),transparent)] text-slate-100 flex flex-col">
      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center">
        <div className="rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] p-5 sm:p-7 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (step === 1) onBack();
                else if (step === 2) setStep(1);
                else void handleCancelPending();
              }}
              className="min-h-[44px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{step === 3 ? 'Start Over' : t.backBtn}</span>
            </button>

            <div className="flex items-center gap-3">
              <InstallButton compact />
        <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />
              <div className="text-right">
                <div className="font-mono-tabular text-xs font-semibold text-sky-300">
                  {t.stepOf} {step} / 3
                </div>
                <div className="text-xs text-slate-400">{t.joinMyFamily}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-colors ${
                  idx <= step ? 'bg-sky-400' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* STEP 1: Open Invitation */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  1. Open your family invitation
                </h1>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Paste the invitation link from your family organizer or load the offline invitation
                  file.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="member-invite-input" className="text-xs font-semibold text-slate-300">
                  Private Invitation Link or File
                </label>
                <label className="min-h-[40px] px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Import File (.json)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleUploadInviteFile}
                    className="sr-only"
                  />
                </label>
              </div>

              <textarea
                id="member-invite-input"
                rows={4}
                value={inviteRaw}
                onChange={(e) => {
                  setInviteRaw(e.target.value);
                  setError(null);
                }}
                placeholder="Paste invitation link (https://... or LWINV1:...) or offline invitation JSON..."
                className="w-full rounded-2xl bg-[#080B0F] border border-white/[0.1] p-3.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />

              <button
                type="button"
                onClick={handleVerifyInvite}
                disabled={verifyingInvite}
                className="min-h-[48px] px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{verifyingInvite ? 'Checking Invitation...' : t.verifyInviteBtn}</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* STEP 2: Set Up Device */}
          {step === 2 && verifiedInvite && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  2. Set up your device
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Invitation verified for{' '}
                  <span className="font-semibold text-amber-300">{verifiedInvite.circleName}</span>{' '}
                  (from {verifiedInvite.issuerName}).
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-300">{t.langLabel}</span>
                <LanguageDropdown
                  id="member-lang-select"
                  label={t.langLabel}
                  value={lang}
                  onChange={onChangeLang}
                  variant="full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="member-preferred-name" className="text-xs font-semibold text-slate-300">
                  Your Preferred Name
                </label>
                <input
                  id="member-preferred-name"
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="e.g. Aunt Maya"
                  className="min-h-[46px] rounded-2xl bg-[#080B0F] border border-white/[0.1] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                />
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={deviceLockEnabled}
                onClick={() => setDeviceLockEnabled((v) => !v)}
                className={`w-full min-h-[56px] p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                  deviceLockEnabled
                    ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-100'
                    : 'bg-[#080B0F] border-white/[0.08] text-slate-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Lock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{t.deviceLockLabel}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Your phone will set up private protection automatically.
                    </div>
                  </div>
                </div>
                <span
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                    deviceLockEnabled
                      ? 'bg-emerald-500 border-transparent text-slate-950'
                      : 'border-white/20 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                </span>
              </button>

              <button
                type="button"
                onClick={handlePrepareDeviceAndRequest}
                disabled={preparingDevice}
                className="min-h-[48px] px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{preparingDevice ? 'Securing Device...' : t.submitJoinBtn}</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* STEP 3: Receive Owner Approval */}
          {step === 3 && pending && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  3. {t.waitingOwnerApproval}
                </h1>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Share this safety code with <span className="text-slate-200 font-medium">{pending.invite.issuerName}</span>{' '}
                  so they can confirm your device and approve access to{' '}
                  <span className="text-amber-300 font-medium">{pending.invite.circleName}</span>.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#080B0F] border border-sky-400/25 flex flex-col items-center gap-2 text-center">
                <span className="text-xs font-semibold text-slate-400">{t.safetyCodeLabel}</span>
                <div className="font-mono-tabular text-3xl sm:text-4xl font-bold tracking-widest text-amber-300">
                  {pending.safetyCode}
                </div>
                <div className="text-xs text-slate-400">
                  {pending.memberName} · {pending.invite.circleName}
                </div>
              </div>

              {/* Offline / Copy Request Bundle */}
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex flex-col gap-3">
                <div className="text-xs font-semibold text-slate-200">
                  Send Approval Request to Organizer (if offline or on another phone)
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(requestToken);
                      setCopiedReq(true);
                      window.setTimeout(() => setCopiedReq(false), 1800);
                    }}
                    className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedReq ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{copiedReq ? 'Copied Request' : 'Copy Approval Request'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile(
                        `join-request-${pending.memberName.toLowerCase().replace(/\s+/g, '-')}.json`,
                        pending.joinRequest
                      )
                    }
                    className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Save Request (.json)</span>
                  </button>
                </div>
              </div>

              {/* Offline / Manual Approval Grant Import */}
              <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="member-grant-input" className="text-xs font-semibold text-slate-300">
                    Already received your organizer&apos;s approval pass?
                  </label>
                  <label className="min-h-[38px] px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Import (.json)</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleUploadGrantFile}
                      className="sr-only"
                    />
                  </label>
                </div>

                <textarea
                  id="member-grant-input"
                  rows={2}
                  value={grantInput}
                  onChange={(e) => {
                    setGrantInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="Paste approval token (LWGRT1:...) or signed grant JSON..."
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />

                <button
                  type="button"
                  onClick={handleVerifyGrantInput}
                  disabled={verifyingGrant}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{verifyingGrant ? 'Verifying Approval...' : t.unlockLineBtn}</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-400/25 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
