/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.OWNERONBOARDINGFLOW
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\OwnerOnboardingFlow.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/OwnerOnboardingFlow.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  clearPendingMemberEnrollment,
  downloadJsonFile,
  saveEnrollmentSession,
  saveKnownRevocations,
  type EnrollmentSession,
} from '../utils/circleStore';
import {
  createEncryptedRecoveryKit,
  decryptCircleMessage,
  DEFAULT_MEMBER_PERMISSIONS,
  encryptCircleMessage,
  generateProtectedDeviceKeys,
  generateUnpredictableCircleId,
  issueOwnerSelfGrant,
  OWNER_PERMISSIONS,
  type CircleAuthorityState,
  type CirclePermissions,
  type DeviceKeyRecord,
  type EncryptedRecoveryKit,
  type GrantPeriod,
  type InviteTtlMinutes,
  type SignedMembershipGrant,
} from '../utils/enrollmentCrypto';
import type { Translations } from '../utils/i18n';
import { LeeWayLogo } from './LeeWayLogo';

interface OwnerOnboardingFlowProps {
  t: Translations;
  onBack: () => void;
  onActivated: (session: EnrollmentSession, keys: DeviceKeyRecord) => void;
}

export function OwnerOnboardingFlow({
  t,
  onBack,
  onActivated,
}: OwnerOnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Owner Identity & Protected Keys
  const [ownerName, setOwnerName] = useState('');
  const [deviceLockEnabled, setDeviceLockEnabled] = useState(false);
  const [ownerKeys, setOwnerKeys] = useState<DeviceKeyRecord | null>(null);
  const [generatingKeys, setGeneratingKeys] = useState(false);

  // Step 2: Private Circle
  const [circleName, setCircleName] = useState('Lee Family');
  const [circleId, setCircleId] = useState(() => generateUnpredictableCircleId());

  // Step 3: Encrypted Recovery Kit
  const [recoveryPass, setRecoveryPass] = useState('');
  const [recoveryPassConfirm, setRecoveryPassConfirm] = useState('');
  const [recoveryKit, setRecoveryKit] = useState<EncryptedRecoveryKit | null>(null);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const [creatingKit, setCreatingKit] = useState(false);

  // Step 4: Invitations & Permissions
  const [memberPermissions, setMemberPermissions] = useState<CirclePermissions>({
    ...DEFAULT_MEMBER_PERMISSIONS,
  });
  const [grantPeriod, setGrantPeriod] = useState<GrantPeriod>('1y');
  const [inviteTtl, setInviteTtl] = useState<InviteTtlMinutes>(60);

  // Step 5: Activation & Encrypted Loopback Test
  const [selfGrant, setSelfGrant] = useState<SignedMembershipGrant | null>(null);
  const [authorityState, setAuthorityState] = useState<CircleAuthorityState | null>(null);
  const [loopbackVerified, setLoopbackVerified] = useState(false);
  const [testingLine, setTestingLine] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleGenerateOwnerKeys = async () => {
    setError(null);
    if (ownerName.trim().length < 2) {
      setError('Enter your display name (at least 2 characters).');
      return;
    }
    if (!deviceLockEnabled) {
      setError('Enable device screen lock or biometric protection before creating device keys.');
      return;
    }
    setGeneratingKeys(true);
    try {
      const keys = await generateProtectedDeviceKeys();
      setOwnerKeys(keys);
    } catch {
      setError('Could not initialize protected keys on this browser.');
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handleCreateRecoveryKit = async () => {
    setError(null);
    if (!ownerKeys) {
      setError('Owner keys are required first.');
      return;
    }
    if (recoveryPass.trim().length < 8) {
      setError('Recovery passphrase must be at least 8 characters.');
      return;
    }
    if (recoveryPass !== recoveryPassConfirm) {
      setError('Recovery passphrases do not match.');
      return;
    }
    setCreatingKit(true);
    try {
      const kit = await createEncryptedRecoveryKit({
        passphrase: recoveryPass,
        circleId,
        circleName: circleName.trim(),
        ownerKeys,
        ownerName: ownerName.trim(),
      });
      setRecoveryKit(kit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recovery kit.');
    } finally {
      setCreatingKit(false);
    }
  };

  const handleRunActivationTest = async () => {
    if (!ownerKeys) return;
    setError(null);
    setTestingLine(true);
    try {
      const cleanName = ownerName.trim();
      const cleanCircle = circleName.trim();
      const grant = await issueOwnerSelfGrant({
        ownerKeys,
        ownerName: cleanName,
        circleId,
        circleName: cleanCircle,
      });

      const nextAuthority: CircleAuthorityState = {
        circleId,
        circleName: cleanCircle,
        ownerDeviceId: ownerKeys.deviceId,
        ownerName: cleanName,
        ownerFingerprint: ownerKeys.fingerprint,
        ownerSignPubJwk: ownerKeys.signPubJwk,
        ownerEcdhPubJwk: ownerKeys.ecdhPubJwk,
        defaultPermissions: memberPermissions,
        defaultGrantPeriod: grantPeriod,
        defaultInviteTtlMinutes: inviteTtl,
        members: [
          {
            deviceId: ownerKeys.deviceId,
            name: cleanName,
            fingerprint: ownerKeys.fingerprint,
            role: 'owner',
            permissions: OWNER_PERMISSIONS,
            grantId: grant.grantId,
            grantPeriod: '1y',
            issuedAt: grant.issuedAt,
            expiresAt: grant.expiresAt,
            revoked: false,
            signPubJwk: ownerKeys.signPubJwk,
            ecdhPubJwk: ownerKeys.ecdhPubJwk,
          },
        ],
        invitations: [],
        pendingRequests: [],
        usedInviteIds: [],
        revokedDeviceIds: [],
      };

      const probeText = `LeeWay local loopback check for ${cleanCircle}`;
      const envelope = await encryptCircleMessage({
        plaintext: probeText,
        senderGrant: grant,
        authorityMembers: nextAuthority.members,
        revokedDeviceIds: [],
      });
      const decrypted = await decryptCircleMessage({
        envelope,
        recipientGrant: grant,
        revokedDeviceIds: [],
      });

      if (decrypted !== probeText) {
        throw new Error('Encrypted loopback test mismatch.');
      }

      setSelfGrant(grant);
      setAuthorityState(nextAuthority);
      setLoopbackVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify encrypted line.');
    } finally {
      setTestingLine(false);
    }
  };

  const handleCompleteActivation = async () => {
    if (!ownerKeys || !selfGrant || !authorityState || !loopbackVerified) return;
    const session: EnrollmentSession = {
      version: 1,
      deviceId: ownerKeys.deviceId,
      role: 'owner',
      userName: ownerName.trim(),
      circleId,
      circleName: circleName.trim(),
      deviceLockEnabled,
      grant: selfGrant,
      authority: authorityState,
      recoveryKitCreatedAt: recoveryKit?.createdAt,
      enrolledAt: Date.now(),
    };
    await clearPendingMemberEnrollment();
    await saveKnownRevocations(circleId, []);
    await saveEnrollmentSession(session);
    onActivated(session, ownerKeys);
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (ownerName.trim().length < 2) {
        setError('Enter your display name (at least 2 characters).');
        return;
      }
      if (!deviceLockEnabled || !ownerKeys) {
        setError('Protect this device and generate your device keys before continuing.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (circleName.trim().length < 2) {
        setError('Give your family circle a friendly name (e.g., Lee Family).');
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!recoveryKit) {
        setError('Create your encrypted recovery kit before continuing.');
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
    }
  };

  const STEP_TITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'Establish the owner identity',
    2: 'Create the private family circle',
    3: 'Protect the recovery capability',
    4: 'Configure invitations & permissions',
    5: 'Activate the secure line',
  };

  return (
    <div className="min-h-[100dvh] bg-[#080B0F] bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(245,158,11,0.08),transparent)] text-slate-100 flex flex-col">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center">
        <div className="rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] p-5 sm:p-7 flex flex-col gap-5">
          {/* Header & Progress */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (step === 1) onBack();
                else setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5);
              }}
              className="min-h-[44px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.backBtn}</span>
            </button>

            <div className="flex items-center gap-3">
              <LeeWayLogo size="sm" showWordmark={false} />
              <div className="text-right">
                <div className="font-mono-tabular text-xs font-semibold text-amber-400">
                  {t.stepOf} {step} / 5
                </div>
                <div className="text-xs text-slate-400">{t.createPrivateLine}</div>
              </div>
            </div>
          </div>

          {/* Segmented Step Bar */}
          <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-colors ${
                  idx <= step ? 'bg-amber-400' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              {step}. {STEP_TITLES[step]}
            </h1>
          </div>

          {/* STEP 1: Owner Identity */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="owner-display-name" className="text-xs font-semibold text-slate-300">
                  {t.displayNameLabel}
                </label>
                <input
                  id="owner-display-name"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Leonard J. Lee"
                  className="min-h-[46px] rounded-2xl bg-[#080B0F] border border-white/[0.1] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
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
                    : 'bg-[#080B0F] border-white/[0.08] text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{t.deviceLockLabel}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.deviceLockHint}</div>
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

              <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Fingerprint className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <span>Device Cryptographic Keys</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateOwnerKeys}
                    disabled={generatingKeys}
                    className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-slate-100 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {ownerKeys
                      ? 'Regenerate Device Keys'
                      : generatingKeys
                      ? 'Generating...'
                      : 'Generate Protected Keys'}
                  </button>
                </div>

                {ownerKeys ? (
                  <div className="text-xs text-emerald-300 flex flex-col gap-1">
                    <span className="font-semibold">
                      Non-extractable ECDSA & ECDH device keys active
                    </span>
                    <span className="font-mono-tabular text-slate-300">
                      Fingerprint: {ownerKeys.fingerprint} · ID: {ownerKeys.deviceId}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Generates non-extractable keys stored inside protected browser key storage—never
                    exported to plaintext localStorage.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Create Private Circle */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="circle-friendly-name" className="text-xs font-semibold text-slate-300">
                  {t.familyCircleNameLabel}
                </label>
                <input
                  id="circle-friendly-name"
                  type="text"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  placeholder="e.g. Lee Family"
                  className="min-h-[46px] rounded-2xl bg-[#080B0F] border border-white/[0.1] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-300">{t.circleIdLabel}</div>
                  <div className="font-mono-tabular text-base font-bold text-amber-300 mt-1">
                    {circleId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCircleId(generateUnpredictableCircleId())}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>New ID</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-100">Role Separation: </span>
                You are registering as the administrator of <span className="text-amber-300">{circleName || 'your family circle'}</span>.
                Circle administration applies strictly to your family line and is separate from LeeWay
                ecosystem runtime authority.
              </div>
            </div>
          )}

          {/* STEP 3: Encrypted Recovery Kit */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] text-xs text-slate-300 leading-relaxed">
                If this phone is lost or replaced, your encrypted recovery kit lets a new device
                verify its circle identity and request renewed authorization. Private device keys are
                never embedded in QR codes or share links.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="recovery-pass-1" className="text-xs font-semibold text-slate-300">
                    {t.recoveryPassphraseLabel}
                  </label>
                  <input
                    id="recovery-pass-1"
                    type="password"
                    value={recoveryPass}
                    onChange={(e) => {
                      setRecoveryPass(e.target.value);
                      setRecoveryKit(null);
                    }}
                    placeholder="8+ characters"
                    className="min-h-[46px] rounded-2xl bg-[#080B0F] border border-white/[0.1] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="recovery-pass-2" className="text-xs font-semibold text-slate-300">
                    Confirm passphrase
                  </label>
                  <input
                    id="recovery-pass-2"
                    type="password"
                    value={recoveryPassConfirm}
                    onChange={(e) => {
                      setRecoveryPassConfirm(e.target.value);
                      setRecoveryKit(null);
                    }}
                    placeholder="Re-enter passphrase"
                    className="min-h-[46px] rounded-2xl bg-[#080B0F] border border-white/[0.1] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400">{t.recoveryPassphraseHint}</p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateRecoveryKit}
                  disabled={creatingKit}
                  className="min-h-[44px] px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-slate-100 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>
                    {creatingKit
                      ? 'Encrypting Kit...'
                      : recoveryKit
                      ? 'Recovery Kit Encrypted'
                      : 'Create Encrypted Recovery Kit'}
                  </span>
                </button>

                {recoveryKit && (
                  <button
                    type="button"
                    onClick={() => {
                      downloadJsonFile(`${circleId.toLowerCase()}-recovery-kit.json`, recoveryKit);
                      setRecoveryDownloaded(true);
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-xs font-semibold text-emerald-200 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {recoveryDownloaded ? 'Saved Backup (.json)' : 'Download Backup (.json)'}
                    </span>
                  </button>
                )}
              </div>

              {recoveryKit && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/25 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    AES-256-GCM recovery kit ready for {recoveryKit.circleName} ({recoveryKit.circleId}).
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Permissions & Grant Policies */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Default permissions for invited family members</span>
                </div>

                <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#080B0F] border border-white/[0.08] overflow-hidden">
                  {(
                    [
                      { key: 'sendMessage', label: 'Send text & voice messages', hint: 'Ordinary communication right' },
                      { key: 'pushToTalk', label: 'Walkie-talkie push-to-talk', hint: 'Instant voice bursts' },
                      { key: 'videoRoom', label: 'Join opt-in private video room', hint: 'Live family video calls' },
                      { key: 'inviteOthers', label: 'Invite other people', hint: 'Off by default (organizer controls invites)' },
                      { key: 'manageDevices', label: 'Approve or revoke family devices', hint: 'Off by default (admin privilege)' },
                    ] as const
                  ).map((perm) => {
                    const checked = memberPermissions[perm.key];
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        onClick={() =>
                          setMemberPermissions((prev) => ({
                            ...prev,
                            [perm.key]: !prev[perm.key],
                          }))
                        }
                        className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100">{perm.label}</div>
                          <div className="text-xs text-slate-400">{perm.hint}</div>
                        </div>
                        <span
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-amber-500 border-transparent text-slate-950'
                              : 'border-white/20 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4" aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Membership Grant Duration
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['6m', '1y'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setGrantPeriod(period)}
                        aria-pressed={grantPeriod === period}
                        className={`min-h-[44px] rounded-xl border text-xs font-semibold cursor-pointer ${
                          grantPeriod === period
                            ? 'bg-amber-500 text-slate-950 border-transparent'
                            : 'bg-[#080B0F] text-slate-200 border-white/[0.08]'
                        }`}
                      >
                        {period === '6m' ? '6 Months' : '1 Year'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Invitation Link Expiry (Single-Use)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {([15, 60, 1440] as const).map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setInviteTtl(mins)}
                        aria-pressed={inviteTtl === mins}
                        className={`min-h-[44px] rounded-xl border text-xs font-semibold cursor-pointer ${
                          inviteTtl === mins
                            ? 'bg-amber-500 text-slate-950 border-transparent'
                            : 'bg-[#080B0F] text-slate-200 border-white/[0.08]'
                        }`}
                      >
                        {mins === 15 ? '15 min' : mins === 60 ? '1 hour' : '24 hours'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Activate Secure Line */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Organizer</span>
                  <span className="font-semibold text-slate-100">{ownerName.trim()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Family Circle</span>
                  <span className="font-semibold text-amber-300">
                    {circleName.trim()} ({circleId})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Owner Fingerprint</span>
                  <span className="font-mono-tabular text-slate-200">{ownerKeys?.fingerprint}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Grant / Invite Policy</span>
                  <span className="text-slate-200">
                    {grantPeriod === '1y' ? '1-year grants' : '6-month grants'} ·{' '}
                    {inviteTtl === 15 ? '15m' : inviteTtl === 60 ? '1h' : '24h'} single-use invites
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunActivationTest}
                disabled={testingLine}
                className={`min-h-[52px] px-4 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  loopbackVerified
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.1] text-white'
                }`}
              >
                {loopbackVerified ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>Signed Authority & Encrypted Loopback Test Passed</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <span>
                      {testingLine
                        ? 'Signing Grants & Testing Encryption...'
                        : 'Confirm Identity & Test Encrypted Line'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-400/25 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          {/* Footer Action */}
          <div className="pt-3 border-t border-white/[0.06] flex justify-end">
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="min-h-[48px] px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/15"
              >
                <span>{t.continueBtn}</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteActivation}
                disabled={!loopbackVerified}
                className="min-h-[48px] px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t.activateLineBtn}</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
