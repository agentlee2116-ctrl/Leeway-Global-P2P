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
import { LeeWayLoadingScreen } from './components/LeeWayLoadingScreen';
import { FamilySharePanel } from './components/FamilySharePanel';
import { SecureSignIn, type SignInDeviceSummary } from './components/SecureSignIn';
import { verifyLocalDevicePossession } from './utils/deviceSignIn';
import {
  hasAccessPassphrase, establishAccessPassphrase, requireAccessPassphrase,
  establishAccessCredential, requireAccessCredential, getAccessUsername, needsPasswordRotation,
  rotateAccessCredential,
} from './utils/signInAccess';
import {
  parseRecipientInviteUrl, type InviteCredentials,
} from './utils/inviteCredentials';
import { holdSplashSince } from './utils/entryPolicy';
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
import { SecureCommsBridge, type DispatchPayload } from './comms/bridge.ts';
import { detectPlatform, type CaptureHandle } from './platform/index.ts';
import { base64ToBytes, bytesToBase64 } from './core/crypto.ts';

type BootPhase = 'checking' | 'sign-in' | 'welcome' | 'owner-setup' | 'member-join' | 'enrolled';

export default function App() {
  const [lang, setLang] = useState<LangCode>(() => {
    const saved = localStorage.getItem('lwp.ui.lang') as LangCode | null;
    return saved && saved in I18N ? saved : 'en';
  });
  const [bootPhase, setBootPhase] = useState<BootPhase>('checking');
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [pendingMember, setPendingMember] = useState<PendingMemberEnrollment | null>(null);
  const [initialInviteParam, setInitialInviteParam] = useState<string | null>(null);

  const [session, setSession] = useState<EnrollmentSession | null>(null);
  const [deviceKeys, setDeviceKeys] = useState<DeviceKeyRecord | null>(null);
  const [signInDevice, setSignInDevice] = useState<SignInDeviceSummary | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [credentialSetupRequired, setCredentialSetupRequired] = useState(false);
  const [entryCycle, setEntryCycle] = useState(0);
  const hasLeftForegroundRef = useRef(false);
  const bootPhaseRef = useRef<BootPhase>('checking');

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

  // Real communications bridge (canonical core contracts) and captured media URLs.
  const bridgeRef = useRef<SecureCommsBridge | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const platform = useMemo(() => detectPlatform(), []);
  const [commState, setCommState] = useState('offline');
  const [inviteCredentials, setInviteCredentials] = useState<InviteCredentials | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseRecipientInviteUrl(window.location.href);
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [rotationRequired, setRotationRequired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const t = I18N[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtlLang(lang) ? 'rtl' : 'ltr';
    localStorage.setItem('lwp.ui.lang', lang);
  }, [lang]);

  // Real communications: relay + per-recipient E2EE + signed ACKs over canonical core.
  useEffect(() => {
    if (bootPhase !== 'enrolled' || !session?.authority || !deviceKeys) return;
    const bridge = new SecureCommsBridge({
      circleId: session.circleId,
      authority: session.authority,
      grant: session.grant,
      deviceKeys,
    }, {
      onDispatch: (payload: DispatchPayload, from: string, id: string) => {
        const member = session.authority?.members.find((m) => m.fingerprint === from);
        const senderName = member?.name ?? 'Family member';
        if (payload.kind === 'text') {
          const res = addTextMessage([], {
            circleId: session.circleId,
            sender: senderName,
            avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
            body: payload.text ?? '',
            offline: false,
            justNowLabel: t.justNow,
          });
          if (res.ok) setTexts((prev) => [...res.messages, ...prev]);
        } else if (payload.kind === 'ptt') {
          const res = addVoiceBurst([], {
            circleId: session.circleId,
            sender: senderName,
            avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
            durationSec: Math.max(1, Math.round((payload.durationMs ?? 1000) / 1000)),
            offline: false,
            justNowLabel: t.justNow,
          });
          {
            setVoiceBursts((prev) => [...res, ...prev]);
            if (payload.mediaBase64) {
              const bytes = base64ToBytes(payload.mediaBase64);
              const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: payload.mime || 'audio/webm' }));
              setMediaUrls((prev) => ({ ...prev, [id]: url }));
            }
          }
        } else if (payload.kind === 'snap') {
          const res = addVideoSnap([], {
            circleId: session.circleId,
            title: payload.name ?? 'Video snap',
            sender: senderName,
            avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
            durationSec: Math.max(1, Math.round((payload.durationMs ?? 1000) / 1000)),
            thumbnailUrl: '',
            offline: false,
            justNowLabel: t.justNow,
          });
          if (res.ok) setSnaps((prev) => [...res.snaps, ...prev]);
        }
        setCommState(`received from ${senderName}`);
      },
      onAck: (_id, acked, total) => setCommState(`signed ACK ${acked}/${total}`),
      onState: (state, detail) => setCommState(`${state}${detail ? ` · ${detail}` : ''}`),
    });
    bridgeRef.current = bridge;
    bridge.connect();
    return () => { bridge.close(); bridgeRef.current = null; };
  }, [bootPhase, session, deviceKeys, t.justNow]);

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

  // Each entry proves knowledge of a secret AND possession of the bound device key.
  // This is offline device unlocking, not an invented email/password cloud account.
  const handleSignIn = async (username: string, passphrase: string, confirmation?: string) => {
    if (signInBusy) return;
    setSignInBusy(true);
    setSignInError(null);
    try {
      const gate = await evaluateEnrollmentGate();
      if (gate.status !== 'enrolled') {
        setSignInDevice(null);
        setLockReason(gate.status === 'locked' ? (gate.reason ?? 'Not enrolled on this device.') : 'Membership approval is pending.');
        throw new Error('This device does not have an active, authorized membership.');
      }
      await verifyLocalDevicePossession(gate.keys, gate.session.grant);
      const deviceId = gate.session.deviceId;
      const configuredUsername = await getAccessUsername(deviceId);
      const isConfigured = await hasAccessPassphrase(deviceId);
      if (!isConfigured) {
        if (gate.session.accessPassphraseConfigured) throw new Error('Device credential missing; recovery required.');
        if (!credentialSetupRequired || !confirmation) throw new Error('Sign-in credential setup is required for this enrolled device.');
        if (passphrase !== confirmation) throw new Error('The two password entries do not match.');
        if (username || inviteCredentials) {
          await establishAccessCredential(deviceId, username || inviteCredentials!.username, passphrase);
        } else {
          await establishAccessPassphrase(deviceId, passphrase);
        }
        await saveEnrollmentSession({ ...gate.session, accessPassphraseConfigured: true });
        setCredentialSetupRequired(false);
        setSignInError('Device protected. Sign in with your username and password.');
        return; // Setting a credential never auto-unlocks.
      }
      if (configuredUsername) {
        const result = await requireAccessCredential(deviceId, username, passphrase);
        setRotationRequired(result.mustRotate);
      } else {
        await requireAccessPassphrase(deviceId, passphrase);
      }
      await hydrateEncryptedFeed(gate.session);
      setSession(gate.session);
      setDeviceKeys(gate.keys);
      setLoginUsername(username || configuredUsername || '');
      setLockReason(null);
      setBootPhase('enrolled');
    } catch (error) {
      setSession(null);
      setDeviceKeys(null);
      setSignInError(error instanceof Error ? error.message : 'Device verification failed.');
      setBootPhase('sign-in');
    } finally {
      setSignInBusy(false);
    }
  };

  // LEEWAY_ENTRY_POLICY_V1 — lock on background/foreground and after BFCache restore.
  useEffect(() => { bootPhaseRef.current = bootPhase; }, [bootPhase]);
  useEffect(() => {
    const relock = () => {
      if (bootPhaseRef.current === 'checking') return;
      hasLeftForegroundRef.current = true;
      // Security boundary: stop live media immediately before requiring re-entry.
      try { captureRef.current?.stop(); } catch { /* device capture may already be stopped */ }
      captureRef.current = null;
      recordingRef.current = false;
      setRecording(false);
      setRecSeconds(0);
      setRoomLive(false);
      setRoomModalOpen(false);
      setVoiceBursts([]);
      setTexts([]);
      setSnaps([]);
      setStoredEnvelopes([]); // React memory cleared; encrypted IndexedDB queue retained.
      setMediaUrls({});
      setSession(null);
      setDeviceKeys(null);
      setSignInError(null);
      setBootPhase('checking');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') relock();
      else if (hasLeftForegroundRef.current) {
        hasLeftForegroundRef.current = false;
        setEntryCycle((cycle) => cycle + 1);
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && bootPhaseRef.current !== 'checking') {
        relock();
        hasLeftForegroundRef.current = false;
        setEntryCycle((cycle) => cycle + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  // Mandatory fail-closed startup gate: minimum six seconds, every entry cycle.
  useEffect(() => {
    let cancelled = false;
    const splashStart = performance.now();
    const runGate = async () => {
      const inviteFromUrl =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('invite')
          : null;

      // Qualification can finish quickly, but the Creator's full logo stays
      // visible for at least 6000 ms before any sign-in screen is shown.
      let gate: Awaited<ReturnType<typeof evaluateEnrollmentGate>> | null = null;
      let gateError: string | null = null;
      try { gate = await evaluateEnrollmentGate(); }
      catch (error) { gateError = error instanceof Error ? error.message : 'Enrollment verification unavailable.'; }
      await holdSplashSince(splashStart);
      if (cancelled) return;
      if (!gate) {
        setSession(null);
        setDeviceKeys(null);
        setSignInDevice(null);
        setLockReason(gateError ?? 'Unable to verify enrollment.');
        setBootPhase('sign-in');
        return;
      }

      if (gate.status === 'enrolled') {
        setSession(null);
        setDeviceKeys(null);
        setSignInDevice({
          userName: gate.session.userName,
          circleName: gate.session.circleName,
          role: gate.session.role,
        });
        setLockReason(null);
        try {
          const configured = await hasAccessPassphrase(gate.session.deviceId);
          if (!configured && gate.session.accessPassphraseConfigured) {
            setSignInDevice(null); // Missing verifier after prior setup: never silently reset access.
            setLockReason('Sign-in credential unavailable. Recover or re-enroll this device.');
          } else setCredentialSetupRequired(!configured);
        } catch (error) {
          setSignInDevice(null);
          setLockReason(error instanceof Error ? error.message : 'Device sign-in store unavailable.');
        }
        if (!cancelled) setBootPhase('sign-in');
        return;
      }

      if (gate.status === 'pending') {
        setPendingMember(gate.pending);
        setBootPhase('sign-in'); // Join My Family resumes existing request.
        return;
      }

      setSession(null);
      setDeviceKeys(null);
      setSignInDevice(null);
      setLockReason(gate.reason ?? null);
      if (inviteFromUrl) setInitialInviteParam(inviteFromUrl);
      setBootPhase('sign-in'); // Invite is held for Join My Family after the sign-in welcome.
    };

    void runGate();
    return () => {
      cancelled = true;
    };
  }, [hydrateEncryptedFeed, entryCycle]);

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
    setSignInDevice({ userName: nextSession.userName, circleName: nextSession.circleName, role: nextSession.role });
    setCredentialSetupRequired(!(await hasAccessPassphrase(nextSession.deviceId)));
    setSession(null);
    setDeviceKeys(null);
    setBootPhase('sign-in');
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
    setSignInDevice({ userName: nextSession.userName, circleName: nextSession.circleName, role: nextSession.role });
    setCredentialSetupRequired(!(await hasAccessPassphrase(nextSession.deviceId)));
    setSession(null);
    setDeviceKeys(null);
    setBootPhase('sign-in');
  };

  const handleResetLocalDevice = async () => {
    await clearEnrollmentSession();
    await clearPendingMemberEnrollment();
    await clearProtectedDeviceKeys();
    setSignInDevice(null);
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

  const handleStartRec = useCallback(async () => {
    if (!session || !canTalk || recordingRef.current) return;
    try {
      const handle = await platform.captureAudio();
      captureRef.current = handle;
      recordingRef.current = true;
      recSecondsRef.current = 0;
      setRecSeconds(0);
      setRecording(true);
      setPlayingBurstId(null);
      setCommState('microphone capture active');
      if (soundEnabled) playWalkieChirp('start');
    } catch (err) {
      setCommState(`microphone unavailable: ${String(err)}`);
    }
  }, [canTalk, platform, session, soundEnabled]);

  const handleStopRec = useCallback(() => {
    const handle = captureRef.current;
    captureRef.current = null;
    if (!recordingRef.current || !session || !handle) return;
    recordingRef.current = false;
    setRecording(false);
    setRecSeconds(0);
    if (soundEnabled) playWalkieChirp('end');

    void handle.result.then(async (burst) => {
      const dur = Math.max(1, Math.round(burst.durationMs / 1000));
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
      const result = await bridgeRef.current?.send({
        kind: 'ptt',
        mediaBase64: bytesToBase64(burst.bytes),
        mime: burst.mime,
        durationMs: burst.durationMs,
        meta: { media: 'audio', mime: burst.mime, name: 'voice-burst', sha256: '', size: burst.bytes.length, ptt: true },
      });
      setCommState(result?.sent ? 'voice burst sent · awaiting signed ACK' : 'voice burst queued offline');
    }).catch((err) => setCommState(`audio capture failed: ${String(err)}`));
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
    const url = mediaUrls[burst.id];
    if (url) {
      const audio = new Audio(url);
      audio.onended = () => { setPlayingBurstId(null); setPlaybackProgress(0); };
      void audio.play().catch((err) => setCommState(`playback failed: ${String(err)}`));
    } else if (soundEnabled) {
      playWalkieChirp('play');
    }
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
      void bridgeRef.current?.send({ kind: 'text', text: body }).then((result) => {
        setCommState(result.sent ? 'dispatch sent · awaiting signed ACK' : 'dispatch queued offline');
      });
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleCreateSnap = (params: {
    title: string;
    durationSec: number;
    thumbnailUrl: string;
    mediaBytes?: string;
    mime?: string;
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
      void bridgeRef.current?.send({
        kind: 'snap',
        name: params.title,
        mediaBase64: params.mediaBytes,
        mime: params.mime,
        durationMs: params.durationSec * 1000,
        meta: {
          media: 'video', mime: params.mime ?? 'video/webm', name: params.title,
          sha256: '', size: params.mediaBytes?.length ?? 0,
        },
      }).then((result) => setCommState(
        params.mediaBytes
          ? (result.sent ? 'video snap sent · awaiting signed ACK' : 'video snap queued offline')
          : 'metadata-only snap: no camera bytes captured',
      ));
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  // STRICT ENROLLMENT GATE: Nothing in Dispatch, Walkie, Media, or Video Room renders until valid enrollment completes
  if (bootPhase === 'checking') {
    return <LeeWayLoadingScreen t={t} />;
  }

  if (bootPhase === 'sign-in') {
    return (
      <SecureSignIn
        t={t}
        lang={lang}
        onChangeLang={setLang}
        device={signInDevice}
        lockReason={lockReason}
        error={signInError}
        busy={signInBusy}
        credentialSetupRequired={credentialSetupRequired}
        username={inviteCredentials?.username || loginUsername}
        onSignIn={handleSignIn}
        onCreatePrivateLine={() => { setLockReason(null); setBootPhase('owner-setup'); }}
        onJoinFamily={() => { setLockReason(null); setBootPhase('member-join'); }}
        onRecover={() => setBootPhase('welcome')}
      />
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
        {deviceKeys && (
          <FamilySharePanel
            t={t}
            session={session}
            deviceKeys={deviceKeys}
            onUpdateSession={handleUpdateSession}
            onNotice={setCommState}
          />
        )}
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

      {bootPhase === 'enrolled' && rotationRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setRotationError(null);
            try {
              await rotateAccessCredential(deviceKeys!.deviceId, currentPassword || inviteCredentials?.temporaryPassword || '', newPassword);
              setRotationRequired(false);
              setNewPassword('');
              setCurrentPassword('');
              setCommState('Password updated — your room is open.');
            } catch (err) {
              setRotationError(err instanceof Error ? err.message : 'Could not change password.');
            }
          }} className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0D1625] p-5 flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold text-slate-100">First login — change your password</h2>
            <p className="text-xs text-slate-400">Your temporary invite password must be replaced before the room opens.</p>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current temporary password" aria-label="Current password"
              className="min-h-[46px] rounded-xl bg-black/40 border border-white/10 px-3 text-sm text-slate-100" />
            <input type="password" required minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (12+ characters)" aria-label="New password"
              className="min-h-[46px] rounded-xl bg-black/40 border border-white/10 px-3 text-sm text-slate-100" />
            {rotationError && <p className="text-xs text-rose-300">{rotationError}</p>}
            <button type="submit" className="min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold">
              Change password &amp; open room
            </button>
          </form>
        </div>
      )}

      {canVideoRoom && (
        <PrivateVideoRoomSheet
          t={t}
          open={roomModalOpen}
          circleId={session.circleId}
          userName={session.userName}
          roomLive={roomLive}
          onToggleRoomLive={() => {
            if (roomLive) {
              bridgeRef.current?.closePrivateRoom();
              setRoomLive(false);
              setCommState('private video room closed');
              return;
            }
            void bridgeRef.current?.startLiveMedia(true).then(() => {
              setRoomLive(true);
              setCommState('private video room connected');
            }).catch((err) => {
              setRoomLive(false);
              setCommState(`live video unavailable: ${String(err)}`);
            });
          }}
          onClose={() => setRoomModalOpen(false)}
        />
      )}
    </div>
  );
}
