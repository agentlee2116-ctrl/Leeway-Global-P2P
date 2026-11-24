/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.APP
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\App.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/App.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMobilePanel } from './components/CircleMobilePanel';
import { DeviceStatusSheet } from './components/DeviceStatusSheet';
import { LeeWayLogo } from './components/LeeWayLogo';
import { MemberOnboardingFlow } from './components/MemberOnboardingFlow';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { OnboardingWelcome } from './components/OnboardingWelcome';
import { OwnerOnboardingFlow } from './components/OwnerOnboardingFlow';
import { PrivateVideoRoomSheet } from './components/PrivateVideoRoomSheet';
import { SecurityDashboardSheet } from './components/SecurityDashboardSheet';
import { SetupBanner } from './components/SetupBanner';
import { TextDispatchCard } from './components/TextDispatchCard';
import { TextThreadSheet } from './components/TextThreadSheet';
import { TopBar } from './components/TopBar';
import { VideoSnapCard } from './components/VideoSnapCard';
import { VideoSnapSheet } from './components/VideoSnapSheet';
import { WalkieDeck } from './components/WalkieDeck';
import {
  addTextMessage,
  addVideoSnap,
  addVoiceBurst,
  countQueuedItems,
  flushOfflineQueue,
  toggleItemReaction,
  type TextDispatch,
  type VideoSnap,
  type VoiceBurst,
} from './utils/circleLogic';
import {
  broadcastSyncEvent,
  clearEnrollmentSession,
  clearPendingMemberEnrollment,
  evaluateEnrollmentGate,
  loadKnownRevocations,
  loadStoredEnvelopes,
  saveEnrollmentSession,
  saveKnownRevocations,
  saveStoredEnvelopes,
  subscribeSyncEvents,
  type EnrollmentSession,
  type PendingMemberEnrollment,
  type StoredCircleEnvelope,
} from './utils/circleStore';
import {
  clearProtectedDeviceKeys,
  decryptCircleMessage,
  encryptCircleMessage,
  verifyJoinRequest,
  type CircleAuthorityState,
  type CircleMemberRecord,
  type DeviceKeyRecord,
} from './utils/enrollmentCrypto';
import { I18N, isRtlLang, type LangCode } from './utils/i18n';
import { playWalkieChirp } from './utils/soundEffects';

type BootPhase = 'checking' | 'welcome' | 'owner-setup' | 'member-join' | 'enrolled';

export default function App() {
  const [lang, setLang] = useState<LangCode>('en');
  const [bootPhase, setBootPhase] = useState<BootPhase>('checking');
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [pendingMember, setPendingMember] = useState<PendingMemberEnrollment | null>(null);
  const [initialInviteParam, setInitialInviteParam] = useState<string | null>(null);

  const [session, setSession] = useState<EnrollmentSession | null>(null);
  const [deviceKeys, setDeviceKeys] = useState<DeviceKeyRecord | null>(null);

  // Encrypted workspace state (only populated after valid enrollment)
  const [offline, setOffline] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlayWalkie, setAutoPlayWalkie] = useState(true);

  const [voiceBursts, setVoiceBursts] = useState<VoiceBurst[]>([]);
  const [texts, setTexts] = useState<TextDispatch[]>([]);
  const [snaps, setSnaps] = useState<VideoSnap[]>([]);
  const [storedEnvelopes, setStoredEnvelopes] = useState<StoredCircleEnvelope[]>([]);

  // Mobile navigation tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('talk');

  // PTT Recording state
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recSecondsRef = useRef(0);
  const recordingRef = useRef(false);

  // Voice playback state
  const [playingBurstId, setPlayingBurstId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  // Bottom sheets / modals
  const [snapSheetState, setSnapSheetState] = useState<{
    open: boolean;
    mode: 'view' | 'create';
    snapId: string | null;
  }>({ open: false, mode: 'view', snapId: null });
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [securitySheetOpen, setSecuritySheetOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomLive, setRoomLive] = useState(false);

  const t = I18N[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtlLang(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  const hydrateEncryptedFeed = useCallback(async (activeSession: EnrollmentSession) => {
    const revocations = await loadKnownRevocations(activeSession.circleId);
    const mergedRevocations = Array.from(
      new Set([...(activeSession.authority?.revokedDeviceIds ?? []), ...revocations])
    );
    const envelopes = await loadStoredEnvelopes(activeSession.circleId);
    const nextVoices: VoiceBurst[] = [];
    const nextTexts: TextDispatch[] = [];
    const nextSnaps: VideoSnap[] = [];

    for (const item of envelopes) {
      try {
        const plaintext = await decryptCircleMessage({
          envelope: item.envelope,
          recipientGrant: activeSession.grant,
          revokedDeviceIds: mergedRevocations,
        });
        const parsed = JSON.parse(plaintext) as VoiceBurst | TextDispatch | VideoSnap;
        if (item.kind === 'voice') {
          nextVoices.push({ ...(parsed as VoiceBurst), queued: item.queued });
        } else if (item.kind === 'text') {
          nextTexts.push({ ...(parsed as TextDispatch), queued: item.queued });
        } else if (item.kind === 'snap') {
          nextSnaps.push({ ...(parsed as VideoSnap), queued: item.queued });
        }
      } catch {
        // Skip undecryptable or revoked items cleanly (fail closed)
      }
    }

    setStoredEnvelopes(envelopes);
    setVoiceBursts(nextVoices);
    setTexts(nextTexts);
    setSnaps(nextSnaps);
  }, []);

  // Mandatory fail-closed startup gate
  useEffect(() => {
    let cancelled = false;
    const runGate = async () => {
      const inviteFromUrl =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('invite')
          : null;

      const gate = await evaluateEnrollmentGate();
      if (cancelled) return;

      if (gate.status === 'enrolled') {
        setSession(gate.session);
        setDeviceKeys(gate.keys);
        setLockReason(null);
        await hydrateEncryptedFeed(gate.session);
        if (!cancelled) setBootPhase('enrolled');
        return;
      }

      if (gate.status === 'pending') {
        setPendingMember(gate.pending);
        setBootPhase('member-join');
        return;
      }

      setSession(null);
      setDeviceKeys(null);
      setLockReason(gate.reason ?? null);
      if (inviteFromUrl) {
        setInitialInviteParam(inviteFromUrl);
        setBootPhase('member-join');
      } else {
        setBootPhase('welcome');
      }
    };

    void runGate();
    return () => {
      cancelled = true;
    };
  }, [hydrateEncryptedFeed]);

  // Listen for live sync events (join requests, revocations, incoming encrypted messages)
  useEffect(() => {
    if (!session) return;
    const unsubscribe = subscribeSyncEvents((msg) => {
      if (msg.circleId !== session.circleId) return;

      if (msg.type === 'REVOCATION_LIST') {
        void (async () => {
          await saveKnownRevocations(session.circleId, msg.revokedDeviceIds);
          if (msg.revokedDeviceIds.includes(session.deviceId)) {
            setSession(null);
            setDeviceKeys(null);
            setVoiceBursts([]);
            setTexts([]);
            setSnaps([]);
            setLockReason('This device has been revoked by the circle administrator.');
            setBootPhase('welcome');
          }
        })();
      }

      if (msg.type === 'JOIN_REQUEST' && session.role === 'owner' && session.authority) {
        void (async () => {
          const authority = session.authority!;
          if (authority.pendingRequests.some((r) => r.requestId === msg.request.requestId)) return;
          const check = await verifyJoinRequest(msg.request, authority);
          if (!check.ok) return;
          const nextAuthority: CircleAuthorityState = {
            ...authority,
            pendingRequests: [msg.request, ...authority.pendingRequests],
          };
          const nextSession = { ...session, authority: nextAuthority };
          await saveEnrollmentSession(nextSession);
          setSession(nextSession);
        })();
      }

      if (msg.type === 'ENCRYPTED_DISPATCH' && msg.item.senderDeviceId !== session.deviceId) {
        void (async () => {
          const current = await loadStoredEnvelopes(session.circleId);
          if (!current.some((e) => e.id === msg.item.id)) {
            await saveStoredEnvelopes(session.circleId, [msg.item, ...current]);
          }
          await hydrateEncryptedFeed(session);
        })();
      }
    });

    return () => unsubscribe();
  }, [session, hydrateEncryptedFeed]);

  const activeAuthorityMembers = useMemo((): CircleMemberRecord[] => {
    if (!session) return [];
    if (session.authority) return session.authority.members;
    return [
      {
        deviceId: session.deviceId,
        name: session.userName,
        fingerprint: session.grant.memberFingerprint,
        role: session.role,
        permissions: session.grant.permissions,
        grantId: session.grant.grantId,
        grantPeriod: session.grant.grantPeriod,
        issuedAt: session.grant.issuedAt,
        expiresAt: session.grant.expiresAt,
        revoked: false,
        signPubJwk: session.grant.memberSignPubJwk,
        ecdhPubJwk: session.grant.memberEcdhPubJwk,
      },
      {
        deviceId: session.grant.ownerDeviceId,
        name: 'Organizer',
        fingerprint: session.grant.ownerFingerprint,
        role: 'owner',
        permissions: session.grant.permissions,
        grantId: 'owner',
        grantPeriod: '1y',
        issuedAt: session.grant.issuedAt,
        expiresAt: session.grant.expiresAt,
        revoked: false,
        signPubJwk: session.grant.ownerSignPubJwk,
        ecdhPubJwk: session.grant.ownerEcdhPubJwk,
      },
    ];
  }, [session]);

  const encryptAndPersistItem = useCallback(
    async (
      kind: 'voice' | 'text' | 'snap',
      item: VoiceBurst | TextDispatch | VideoSnap,
      activeSession: EnrollmentSession
    ) => {
      try {
        const revocations = await loadKnownRevocations(activeSession.circleId);
        const mergedRevocations = Array.from(
          new Set([...(activeSession.authority?.revokedDeviceIds ?? []), ...revocations])
        );
        const members = activeSession.authority?.members ?? activeAuthorityMembers;

        const envelope = await encryptCircleMessage({
          plaintext: JSON.stringify(item),
          senderGrant: activeSession.grant,
          authorityMembers: members,
          revokedDeviceIds: mergedRevocations,
        });

        const stored: StoredCircleEnvelope = {
          id: item.id,
          kind,
          circleId: activeSession.circleId,
          senderName: activeSession.userName,
          senderDeviceId: activeSession.deviceId,
          queued: item.queued,
          createdAt: Date.now(),
          envelope,
        };

        setStoredEnvelopes((prev) => {
          const next = [stored, ...prev];
          void saveStoredEnvelopes(activeSession.circleId, next);
          return next;
        });

        if (!item.queued) {
          broadcastSyncEvent({
            type: 'ENCRYPTED_DISPATCH',
            circleId: activeSession.circleId,
            item: stored,
          });
        }
      } catch (err) {
        setSession(null);
        setDeviceKeys(null);
        setLockReason(
          err instanceof Error ? err.message : 'Authorization invalid; encrypted dispatch blocked.'
        );
        setBootPhase('welcome');
      }
    },
    [activeAuthorityMembers]
  );

  const handleOwnerActivated = async (
    nextSession: EnrollmentSession,
    keys: DeviceKeyRecord
  ) => {
    setSession(nextSession);
    setDeviceKeys(keys);
    setLockReason(null);

    const welcomeRes = addTextMessage([], {
      circleId: nextSession.circleId,
      sender: nextSession.userName,
      avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
      body: `Encrypted private line active for ${nextSession.circleName}. Share single-use invites from the Security dashboard.`,
      offline: false,
      justNowLabel: t.justNow,
    });

    if (welcomeRes.ok) {
      setTexts(welcomeRes.messages);
      await encryptAndPersistItem('text', welcomeRes.messages[0], nextSession);
    }
    setBootPhase('enrolled');
  };

  const handleMemberUnlocked = async (
    nextSession: EnrollmentSession,
    keys: DeviceKeyRecord
  ) => {
    setSession(nextSession);
    setDeviceKeys(keys);
    setPendingMember(null);
    setLockReason(null);
    await hydrateEncryptedFeed(nextSession);
    setBootPhase('enrolled');
  };

  const handleResetLocalDevice = async () => {
    await clearEnrollmentSession();
    await clearPendingMemberEnrollment();
    await clearProtectedDeviceKeys();
    setSecuritySheetOpen(false);
    setRoomModalOpen(false);
    setTextModalOpen(false);
    setSnapSheetState({ open: false, mode: 'view', snapId: null });
    setSession(null);
    setDeviceKeys(null);
    setVoiceBursts([]);
    setTexts([]);
    setSnaps([]);
    setStoredEnvelopes([]);
    setLockReason(null);
    setBootPhase('welcome');
  };

  const handleUpdateSession = async (nextSession: EnrollmentSession) => {
    await saveEnrollmentSession(nextSession);
    setSession(nextSession);
  };

  const queuedCount = useMemo(
    () => countQueuedItems(voiceBursts, texts, snaps),
    [voiceBursts, texts, snaps]
  );
  const deliveredCount = useMemo(
    () =>
      voiceBursts.filter((v) => !v.queued).length +
      texts.filter((tx) => !tx.queued).length +
      snaps.filter((s) => !s.queued).length,
    [voiceBursts, texts, snaps]
  );

  const activeSnap = useMemo(
    () => snaps.find((s) => s.id === snapSheetState.snapId) ?? null,
    [snaps, snapSheetState.snapId]
  );

  // Recording interval
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      recSecondsRef.current += 1;
      setRecSeconds(recSecondsRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  // Playback progress interval
  useEffect(() => {
    if (!playingBurstId) {
      setPlaybackProgress(0);
      return;
    }
    const burst = voiceBursts.find((b) => b.id === playingBurstId);
    if (!burst) {
      setPlayingBurstId(null);
      return;
    }
    const totalMs = Math.max(1500, burst.durationSec * 400);
    const stepMs = 100;
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += stepMs;
      const ratio = Math.min(1, elapsed / totalMs);
      setPlaybackProgress(ratio);
      if (ratio >= 1) {
        window.clearInterval(timer);
        setPlayingBurstId(null);
        setPlaybackProgress(0);
      }
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [playingBurstId, voiceBursts]);

  const canTalk = Boolean(session?.grant.permissions.pushToTalk);
  const canSend = Boolean(session?.grant.permissions.sendMessage);
  const canVideoRoom = Boolean(session?.grant.permissions.videoRoom);

  const handleStartRec = useCallback(() => {
    if (!session || !canTalk || recordingRef.current) return;
    recordingRef.current = true;
    recSecondsRef.current = 1;
    setRecSeconds(1);
    setRecording(true);
    setPlayingBurstId(null);
    if (soundEnabled) playWalkieChirp('start');
  }, [canTalk, session, soundEnabled]);

  const handleStopRec = useCallback(() => {
    if (!recordingRef.current || !session) return;
    recordingRef.current = false;
    const dur = Math.max(1, recSecondsRef.current);
    setRecording(false);
    setRecSeconds(0);
    if (soundEnabled) playWalkieChirp('end');

    const nextList = addVoiceBurst(voiceBursts, {
      circleId: session.circleId,
      sender: `${session.userName} (${t.youLabel})`,
      avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
      durationSec: dur,
      offline,
      justNowLabel: t.justNow,
    });
    setVoiceBursts(nextList);
    void encryptAndPersistItem('voice', nextList[0], session);
  }, [encryptAndPersistItem, offline, session, soundEnabled, t.justNow, t.youLabel, voiceBursts]);

  // Spacebar Push-to-Talk shortcut (active only when enrolled & permitted)
  useEffect(() => {
    if (bootPhase !== 'enrolled' || !canTalk) return;

    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isEditable(e.target)) {
        if (snapSheetState.open || textModalOpen || securitySheetOpen || roomModalOpen) {
          return;
        }
        e.preventDefault();
        handleStartRec();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && recordingRef.current) {
        e.preventDefault();
        handleStopRec();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    bootPhase,
    canTalk,
    handleStartRec,
    handleStopRec,
    roomModalOpen,
    securitySheetOpen,
    snapSheetState.open,
    textModalOpen,
  ]);

  const handleToggleOffline = () => {
    if (!session) return;
    setOffline((prev) => {
      const nextOffline = !prev;
      if (!nextOffline) {
        setVoiceBursts((v) => flushOfflineQueue(v));
        setTexts((tx) => flushOfflineQueue(tx));
        setSnaps((s) => flushOfflineQueue(s));
        const flushed = storedEnvelopes.map((e) => ({ ...e, queued: false }));
        setStoredEnvelopes(flushed);
        void saveStoredEnvelopes(session.circleId, flushed);
      }
      return nextOffline;
    });
  };

  const handleTogglePlayBurst = (burst: VoiceBurst) => {
    if (playingBurstId === burst.id) {
      setPlayingBurstId(null);
      return;
    }
    if (soundEnabled) playWalkieChirp('play');
    setPlayingBurstId(burst.id);
    setPlaybackProgress(0.08);
  };

  const handleSendText = (body: string) => {
    if (!session || !canSend) {
      return { ok: false, error: 'Messaging is restricted for this device.' };
    }
    const res = addTextMessage(texts, {
      circleId: session.circleId,
      sender: `${session.userName} (${t.youLabel})`,
      avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
      body,
      offline,
      justNowLabel: t.justNow,
    });
    if (res.ok) {
      setTexts(res.messages);
      void encryptAndPersistItem('text', res.messages[0], session);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleCreateSnap = (params: {
    title: string;
    durationSec: number;
    thumbnailUrl: string;
  }) => {
    if (!session || !canSend) {
      return { ok: false, error: 'Sending media is restricted for this device.' };
    }
    const res = addVideoSnap(snaps, {
      circleId: session.circleId,
      title: params.title,
      sender: `${session.userName} (${t.youLabel})`,
      avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
      durationSec: params.durationSec,
      thumbnailUrl: params.thumbnailUrl,
      offline,
      justNowLabel: t.justNow,
    });
    if (res.ok) {
      setSnaps(res.snaps);
      void encryptAndPersistItem('snap', res.snaps[0], session);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  // STRICT ENROLLMENT GATE: Nothing in Dispatch, Walkie, Media, or Video Room renders until valid enrollment completes
  if (bootPhase === 'checking') {
    return (
      <div className="min-h-[100dvh] bg-[#080B0F] text-slate-300 flex flex-col items-center justify-center gap-4 p-6 text-sm text-center">
        <LeeWayLogo size="crest" showWordmark={false} />
        <div className="flex flex-col gap-1">
          <span className="font-display text-lg font-bold text-slate-100">{t.appName}</span>
          <span className="text-xs text-slate-400">Verifying device enrollment...</span>
        </div>
      </div>
    );
  }

  if (bootPhase === 'welcome') {
    return (
      <OnboardingWelcome
        t={t}
        lang={lang}
        onChangeLang={setLang}
        onStartOwnerSetup={() => {
          setLockReason(null);
          setBootPhase('owner-setup');
        }}
        onStartMemberJoin={() => {
          setLockReason(null);
          setBootPhase('member-join');
        }}
        lockReason={lockReason}
        onResetLockedDevice={lockReason ? handleResetLocalDevice : undefined}
      />
    );
  }

  if (bootPhase === 'owner-setup') {
    return (
      <OwnerOnboardingFlow
        t={t}
        onBack={() => setBootPhase('welcome')}
        onActivated={handleOwnerActivated}
      />
    );
  }

  if (bootPhase === 'member-join') {
    return (
      <MemberOnboardingFlow
        t={t}
        lang={lang}
        onChangeLang={setLang}
        initialPending={pendingMember}
        initialInviteParam={initialInviteParam}
        onBack={() => {
          setPendingMember(null);
          setInitialInviteParam(null);
          setBootPhase('welcome');
        }}
        onUnlocked={handleMemberUnlocked}
      />
    );
  }

  if (!session || !deviceKeys) {
    return (
      <OnboardingWelcome
        t={t}
        lang={lang}
        onChangeLang={setLang}
        onStartOwnerSetup={() => setBootPhase('owner-setup')}
        onStartMemberJoin={() => setBootPhase('member-join')}
        lockReason="Device session could not be verified."
        onResetLockedDevice={handleResetLocalDevice}
      />
    );
  }

  const pendingApprovalsCount = session.authority?.pendingRequests.length ?? 0;

  return (
    <div className="min-h-[100dvh] bg-[#080B0F] bg-[radial-gradient(ellipse_80%_45%_at_50%_-12%,rgba(245,158,11,0.06),transparent)] text-slate-100 flex flex-col">
      <TopBar
        t={t}
        lang={lang}
        onChangeLang={setLang}
        offline={offline}
        queuedCount={queuedCount}
        onToggleOffline={handleToggleOffline}
        circleId={session.circleId}
        circleName={session.circleName}
        role={session.role}
        pendingApprovalsCount={pendingApprovalsCount}
        canVideoRoom={canVideoRoom}
        onOpenSecurity={() => setSecuritySheetOpen(true)}
        onOpenVideoRoom={() => setRoomModalOpen(true)}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pt-3.5 sm:pt-5 pb-24 md:pb-10 flex flex-col gap-3.5 sm:gap-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch">
          {/* Left / Walkie-Talkie Handset Column */}
          <div
            className={`md:col-span-6 lg:col-span-6 ${
              mobileTab === 'talk' ? 'block' : 'hidden md:block'
            }`}
          >
            <WalkieDeck
              t={t}
              circleId={session.circleId}
              circleName={session.circleName}
              canTalk={canTalk}
              recording={recording}
              recSeconds={recSeconds}
              onStartRec={handleStartRec}
              onStopRec={handleStopRec}
              bursts={voiceBursts}
              playingBurstId={playingBurstId}
              playbackProgress={playbackProgress}
              onTogglePlayBurst={handleTogglePlayBurst}
              onOpenSetup={() => setSecuritySheetOpen(true)}
            />
          </div>

          {/* Right / Video Snaps & Text Dispatches Column */}
          <div className="md:col-span-6 lg:col-span-6 flex flex-col gap-4 sm:gap-5">
            <div className={mobileTab === 'snaps' ? 'block' : 'hidden md:block'}>
              <VideoSnapCard
                t={t}
                snaps={snaps}
                onOpenSnap={(snap) =>
                  setSnapSheetState({ open: true, mode: 'view', snapId: snap.id })
                }
                onOpenNewSnap={() => {
                  if (canSend) {
                    setSnapSheetState({ open: true, mode: 'create', snapId: null });
                  }
                }}
              />
            </div>

            <div className={mobileTab === 'messages' ? 'block' : 'hidden md:block'}>
              <TextDispatchCard
                t={t}
                lang={lang}
                canSend={canSend}
                messages={texts}
                onOpenThread={() => setTextModalOpen(true)}
                onSendText={handleSendText}
              />
            </div>

            {mobileTab === 'circle' && (
              <div className="md:hidden">
                <CircleMobilePanel
                  t={t}
                  session={session}
                  pendingApprovalsCount={pendingApprovalsCount}
                  onOpenSecurity={() => setSecuritySheetOpen(true)}
                  onOpenVideoRoom={() => setRoomModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Owner-Only Security Quick Banner */}
        {session.role === 'owner' && showSetupBanner && (
          <SetupBanner
            t={t}
            onOpenSetup={() => setSecuritySheetOpen(true)}
            onDismiss={() => setShowSetupBanner(false)}
          />
        )}
      </main>

      <MobileBottomNav
        t={t}
        activeTab={mobileTab}
        onSelectTab={setMobileTab}
        unreadSnapsCount={snaps.length}
        unreadTextsCount={texts.length}
      />

      <VideoSnapSheet
        t={t}
        open={snapSheetState.open}
        mode={snapSheetState.mode}
        snap={activeSnap}
        snaps={snaps}
        circleId={session.circleId}
        onSelectSnap={(snap) =>
          setSnapSheetState({ open: true, mode: 'view', snapId: snap.id })
        }
        onToggleReaction={(snapId, emoji) =>
          setSnaps((prev) => toggleItemReaction(prev, snapId, emoji))
        }
        onClose={() => setSnapSheetState((s) => ({ ...s, open: false }))}
        onCreateSnap={handleCreateSnap}
      />

      <TextThreadSheet
        t={t}
        open={textModalOpen}
        messages={texts}
        onClose={() => setTextModalOpen(false)}
        onSendText={handleSendText}
        onToggleReaction={(msgId, emoji) =>
          setTexts((prev) => toggleItemReaction(prev, msgId, emoji))
        }
      />

      {session.role === 'owner' ? (
        <SecurityDashboardSheet
          t={t}
          open={securitySheetOpen}
          session={session}
          ownerKeys={deviceKeys}
          queuedCount={queuedCount}
          deliveredCount={deliveredCount}
          onUpdateSession={handleUpdateSession}
          onResetLocalDevice={handleResetLocalDevice}
          onClose={() => setSecuritySheetOpen(false)}
        />
      ) : (
        <DeviceStatusSheet
          t={t}
          open={securitySheetOpen}
          session={session}
          keys={deviceKeys}
          soundEnabled={soundEnabled}
          autoPlayWalkie={autoPlayWalkie}
          onToggleSound={() => setSoundEnabled((s) => !s)}
          onToggleAutoPlay={() => setAutoPlayWalkie((a) => !a)}
          onResetLocalDevice={handleResetLocalDevice}
          onClose={() => setSecuritySheetOpen(false)}
        />
      )}

      {canVideoRoom && (
        <PrivateVideoRoomSheet
          t={t}
          open={roomModalOpen}
          circleId={session.circleId}
          userName={session.userName}
          roomLive={roomLive}
          onToggleRoomLive={() => setRoomLive((live) => !live)}
          onClose={() => setRoomModalOpen(false)}
        />
      )}
    </div>
  );
}
