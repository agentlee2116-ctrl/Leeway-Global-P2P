/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.SECURITYDASHBOARDSHEET
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\SecurityDashboardSheet.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/SecurityDashboardSheet.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  downloadJsonFile,
  encodeBundleToken,
  encodeInviteShareUrl,
  loadRelayJoinRequests,
  parseBundleInput,
  publishRelayMembershipGrant,
  publishRevocationList,
  removeRelayJoinRequest,
  type EnrollmentSession,
} from '../utils/circleStore';
import {
  approveJoinRequest,
  createEncryptedRecoveryKit,
  createSignedInvitation,
  revokeCircleDevice,
  verifyJoinRequest,
  type CircleAuthorityState,
  type DeviceKeyRecord,
  type GrantPeriod,
  type InviteTtlMinutes,
  type JoinRequestBundle,
  type SignedInvitation,
  type SignedMembershipGrant,
} from '../utils/enrollmentCrypto';
import type { Translations } from '../utils/i18n';
import { BottomSheetModal } from './BottomSheetModal';
import { QrCodeMatrix } from './QrCodeMatrix';

interface SecurityDashboardSheetProps {
  t: Translations;
  open: boolean;
  session: EnrollmentSession;
  ownerKeys: DeviceKeyRecord;
  queuedCount: number;
  deliveredCount: number;
  onUpdateSession: (next: EnrollmentSession) => Promise<void>;
  onResetLocalDevice: () => Promise<void>;
  onClose: () => void;
}

type DashTab = 'invites' | 'approvals' | 'members' | 'recovery';

export function SecurityDashboardSheet({
  t,
  open,
  session,
  ownerKeys,
  queuedCount,
  deliveredCount,
  onUpdateSession,
  onResetLocalDevice,
  onClose,
}: SecurityDashboardSheetProps) {
  const [tab, setTab] = useState<DashTab>('invites');
  const [ttlMinutes, setTtlMinutes] = useState<InviteTtlMinutes>(
    session.authority?.defaultInviteTtlMinutes ?? 60
  );
  const [grantPeriod, setGrantPeriod] = useState<GrantPeriod>(
    session.authority?.defaultGrantPeriod ?? '6m'
  );
  const [selectedInvite, setSelectedInvite] = useState<SignedInvitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Approvals & offline request import
  const [offlineReqInput, setOfflineReqInput] = useState('');
  const [issuedGrantToken, setIssuedGrantToken] = useState<{
    memberName: string;
    grant: SignedMembershipGrant;
    token: string;
  } | null>(null);

  // Recovery kit regeneration
  const [recPass, setRecPass] = useState('');
  const [recFeedback, setRecFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const authority = session.authority;

  // Sync any relay join requests when dashboard opens
  useEffect(() => {
    if (!open || !authority) return;
    let cancelled = false;
    const syncRelay = async () => {
      const incoming = await loadRelayJoinRequests(authority.circleId);
      if (cancelled || incoming.length === 0) return;

      const existingIds = new Set(authority.pendingRequests.map((r) => r.requestId));
      const newOnes: JoinRequestBundle[] = [];
      for (const req of incoming) {
        if (existingIds.has(req.requestId)) continue;
        const check = await verifyJoinRequest(req, authority);
        if (check.ok) {
          newOnes.push(req);
        }
      }
      if (!cancelled && newOnes.length > 0) {
        const nextAuthority: CircleAuthorityState = {
          ...authority,
          pendingRequests: [...newOnes, ...authority.pendingRequests],
        };
        await onUpdateSession({ ...session, authority: nextAuthority });
      }
    };
    void syncRelay();
    return () => {
      cancelled = true;
    };
  }, [open, authority, session, onUpdateSession]);

  if (!authority) return null;

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCreateInvite = async () => {
    setError(null);
    const invite = await createSignedInvitation({
      ownerKeys,
      ownerName: session.userName,
      circleId: authority.circleId,
      circleName: authority.circleName,
      ttlMinutes,
      defaultGrantPeriod: grantPeriod,
      permissions: authority.defaultPermissions,
    });

    const nextAuthority: CircleAuthorityState = {
      ...authority,
      invitations: [{ invite, status: 'active' }, ...authority.invitations],
    };
    await onUpdateSession({ ...session, authority: nextAuthority });
    setSelectedInvite(invite);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const nextAuthority: CircleAuthorityState = {
      ...authority,
      usedInviteIds: authority.usedInviteIds.includes(inviteId)
        ? authority.usedInviteIds
        : [...authority.usedInviteIds, inviteId],
      invitations: authority.invitations.map((entry) =>
        entry.invite.inviteId === inviteId ? { ...entry, status: 'revoked' } : entry
      ),
    };
    await onUpdateSession({ ...session, authority: nextAuthority });
    if (selectedInvite?.inviteId === inviteId) {
      setSelectedInvite(null);
    }
  };

  const handleImportOfflineRequest = async () => {
    setError(null);
    const parsed = parseBundleInput<JoinRequestBundle>(offlineReqInput, 'LWREQ1');
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const check = await verifyJoinRequest(parsed.data, authority);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    const nextAuthority: CircleAuthorityState = {
      ...authority,
      pendingRequests: [
        parsed.data,
        ...authority.pendingRequests.filter((r) => r.requestId !== parsed.data.requestId),
      ],
    };
    await onUpdateSession({ ...session, authority: nextAuthority });
    setOfflineReqInput('');
  };

  const handleUploadReqFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOfflineReqInput(await file.text());
    setError(null);
  };

  const handleApproveRequest = async (req: JoinRequestBundle) => {
    setError(null);
    try {
      const { grant, nextAuthority } = await approveJoinRequest({
        ownerKeys,
        authority,
        request: req,
        grantPeriod,
      });
      await onUpdateSession({ ...session, authority: nextAuthority });
      await removeRelayJoinRequest(authority.circleId, req.requestId);
      await publishRelayMembershipGrant(grant);
      setIssuedGrantToken({
        memberName: req.memberName,
        grant,
        token: encodeBundleToken('LWGRT1', grant),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    }
  };

  const handleRejectRequest = async (req: JoinRequestBundle) => {
    const nextAuthority: CircleAuthorityState = {
      ...authority,
      pendingRequests: authority.pendingRequests.filter((r) => r.requestId !== req.requestId),
    };
    await onUpdateSession({ ...session, authority: nextAuthority });
    await removeRelayJoinRequest(authority.circleId, req.requestId);
  };

  const handleRevokeMemberDevice = async (deviceId: string) => {
    const nextAuthority = revokeCircleDevice(authority, deviceId);
    await onUpdateSession({ ...session, authority: nextAuthority });
    await publishRevocationList(authority.circleId, nextAuthority.revokedDeviceIds);
  };

  const handleDownloadNewRecoveryKit = async () => {
    setError(null);
    setRecFeedback(null);
    if (recPass.trim().length < 8) {
      setError('Enter a passphrase with at least 8 characters.');
      return;
    }
    try {
      const kit = await createEncryptedRecoveryKit({
        passphrase: recPass,
        circleId: authority.circleId,
        circleName: authority.circleName,
        ownerKeys,
        ownerName: session.userName,
      });
      downloadJsonFile(`${authority.circleId.toLowerCase()}-recovery-kit.json`, kit);
      setRecPass('');
      setRecFeedback('Fresh AES-GCM encrypted recovery kit downloaded.');
      await onUpdateSession({ ...session, recoveryKitCreatedAt: kit.createdAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create recovery kit.');
    }
  };

  const now = Date.now();
  const activeInviteToRender =
    selectedInvite ?? authority.invitations.find((i) => i.status === 'active' && i.invite.expiresAt > now)?.invite ?? null;

  return (
    <BottomSheetModal
      open={open}
      title={t.setupModalTitle}
      subtitle={`${authority.circleName} · ${authority.circleId}`}
      closeLabel={t.close}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* Dashboard Section Tabs */}
        <div
          role="tablist"
          aria-label="Security dashboard sections"
          className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#080B0F] border border-white/[0.08]"
        >
          {(
            [
              { id: 'invites', label: 'Invites', count: authority.invitations.filter((i) => i.status === 'active' && i.invite.expiresAt > now).length },
              { id: 'approvals', label: 'Approvals', count: authority.pendingRequests.length },
              { id: 'members', label: 'Devices', count: authority.members.filter((m) => !m.revoked).length },
              { id: 'recovery', label: 'Recovery', count: 0 },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(item.id);
                  setError(null);
                }}
                className={`min-h-[42px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <span>{item.label}</span>
                {item.count > 0 && (
                  <span className="font-mono-tabular text-[11px] opacity-80">({item.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: INVITATIONS */}
        {tab === 'invites' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dash-invite-ttl" className="text-xs font-semibold text-slate-300">
                    Invite Expiry
                  </label>
                  <select
                    id="dash-invite-ttl"
                    value={ttlMinutes}
                    onChange={(e) => setTtlMinutes(Number(e.target.value) as InviteTtlMinutes)}
                    className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100"
                  >
                    <option value={15} className="bg-[#0E131A]">15 minutes</option>
                    <option value={60} className="bg-[#0E131A]">1 hour</option>
                    <option value={1440} className="bg-[#0E131A]">24 hours</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dash-grant-period" className="text-xs font-semibold text-slate-300">
                    Grant Period
                  </label>
                  <select
                    id="dash-grant-period"
                    value={grantPeriod}
                    onChange={(e) => setGrantPeriod(e.target.value as GrantPeriod)}
                    className="min-h-[42px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100"
                  >
                    <option value="6m" className="bg-[#0E131A]">6 Months</option>
                    <option value="1y" className="bg-[#0E131A]">1 Year</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateInvite}
                className="min-h-[46px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Create Single-Use Signed Invitation</span>
              </button>
            </div>

            {activeInviteToRender && (
              <div className="p-4 rounded-2xl bg-[#080B0F] border border-amber-400/25 flex flex-col sm:flex-row items-center gap-4">
                <QrCodeMatrix
                  value={encodeInviteShareUrl(activeInviteToRender)}
                  label={`QR invitation for ${authority.circleName}`}
                  size={156}
                />
                <div className="flex-1 min-w-0 flex flex-col gap-2.5 w-full">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Single-Use Invite · No private keys embedded</span>
                  </div>
                  <div className="font-mono-tabular text-[11px] text-slate-400">
                    ID: {activeInviteToRender.inviteId} · Expires{' '}
                    {new Date(activeInviteToRender.expiresAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyText('invite-token', encodeBundleToken('LWINV1', activeInviteToRender))
                      }
                      className="min-h-[40px] px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === 'invite-token' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{copiedId === 'invite-token' ? 'Copied Token' : 'Copy Invite Token'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        copyText('invite-url', encodeInviteShareUrl(activeInviteToRender))
                      }
                      className="min-h-[40px] px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{copiedId === 'invite-url' ? 'Copied Link' : 'Copy Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadJsonFile(
                          `${activeInviteToRender.inviteId}.json`,
                          activeInviteToRender
                        )
                      }
                      className="min-h-[40px] px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Offline .json</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Invite History */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-slate-400">Issued Invitations</div>
              {authority.invitations.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.06] text-xs text-slate-400 text-center">
                  No invitations issued yet.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#080B0F] border border-white/[0.08] overflow-hidden">
                  {authority.invitations.map(({ invite, status }) => {
                    const effectiveStatus =
                      status === 'active' && now > invite.expiresAt ? 'expired' : status;
                    return (
                      <div
                        key={invite.inviteId}
                        className="px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-mono-tabular text-xs font-semibold text-slate-100 truncate">
                            {invite.inviteId}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Status: <span className="capitalize text-slate-200">{effectiveStatus}</span>{' '}
                            · {invite.defaultGrantPeriod === '1y' ? '1y grant' : '6m grant'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {effectiveStatus === 'active' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedInvite(invite)}
                                className="min-h-[38px] px-3 rounded-lg bg-white/[0.05] text-xs font-semibold text-slate-200 cursor-pointer"
                              >
                                Show QR
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(invite.inviteId)}
                                className="min-h-[38px] px-3 rounded-lg bg-red-500/15 text-xs font-semibold text-red-200 cursor-pointer"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PENDING APPROVALS */}
        {tab === 'approvals' && (
          <div className="flex flex-col gap-4">
            {issuedGrantToken && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                  <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Signed Membership Grant Issued for {issuedGrantToken.memberName}</span>
                </div>
                <p className="text-xs text-emerald-100/85">
                  Send this approval pass back if their device is offline, or they will unlock
                  automatically over the local sync channel.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText('grant-token', issuedGrantToken.token)}
                    className="min-h-[40px] px-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{copiedId === 'grant-token' ? 'Copied Approval' : 'Copy Approval Pass'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile(
                        `grant-${issuedGrantToken.memberName.toLowerCase().replace(/\s+/g, '-')}.json`,
                        issuedGrantToken.grant
                      )
                    }
                    className="min-h-[40px] px-3 rounded-xl bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Save Grant (.json)</span>
                  </button>
                </div>
              </div>
            )}

            {authority.pendingRequests.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.06] text-xs text-slate-400 text-center">
                No pending join requests right now.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {authority.pendingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="p-4 rounded-2xl bg-[#080B0F] border border-sky-400/25 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{req.memberName}</div>
                        <div className="font-mono-tabular text-[11px] text-slate-400 mt-0.5">
                          Device: {req.memberDeviceId} · FP: {req.memberFingerprint}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">{t.safetyCodeLabel}</div>
                        <div className="font-mono-tabular text-lg font-bold text-amber-300">
                          {req.safetyCode}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <span>Grant:</span>
                        <button
                          type="button"
                          onClick={() => setGrantPeriod('6m')}
                          className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                            grantPeriod === '6m'
                              ? 'bg-amber-500 text-slate-950 border-transparent'
                              : 'bg-white/[0.04] text-slate-300 border-white/10'
                          }`}
                        >
                          6m
                        </button>
                        <button
                          type="button"
                          onClick={() => setGrantPeriod('1y')}
                          className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                            grantPeriod === '1y'
                              ? 'bg-amber-500 text-slate-950 border-transparent'
                              : 'bg-white/[0.04] text-slate-300 border-white/10'
                          }`}
                        >
                          1y
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req)}
                          className="min-h-[40px] px-3 rounded-xl bg-red-500/15 text-red-200 text-xs font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(req)}
                          className="min-h-[40px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          Verify Code & Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Offline Join Request Import */}
            <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="owner-offline-req" className="text-xs font-semibold text-slate-300">
                  Import Offline Join Request
                </label>
                <label className="min-h-[36px] px-3 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Load .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleUploadReqFile}
                    className="sr-only"
                  />
                </label>
              </div>
              <textarea
                id="owner-offline-req"
                rows={2}
                value={offlineReqInput}
                onChange={(e) => setOfflineReqInput(e.target.value)}
                placeholder="Paste member request token (LWREQ1:...) or JSON..."
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] p-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={handleImportOfflineRequest}
                className="min-h-[42px] px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-white self-start cursor-pointer"
              >
                Verify & Queue Request
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MEMBERS, DEVICES & DELIVERY */}
        {tab === 'members' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#080B0F] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Delivered Encrypted</div>
                <div className="font-mono-tabular text-lg font-bold text-emerald-300 mt-0.5">
                  {deliveredCount}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#080B0F] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Queued Offline</div>
                <div className="font-mono-tabular text-lg font-bold text-amber-300 mt-0.5">
                  {queuedCount}
                </div>
              </div>
            </div>

            <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#080B0F] border border-white/[0.08] overflow-hidden">
              {authority.members.map((member) => (
                <div
                  key={member.deviceId}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Users className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{member.name}</span>
                      <span className="text-xs font-normal text-slate-400">
                        · {member.role === 'owner' ? t.ownerRoleBadge : t.memberRoleBadge}
                      </span>
                    </div>
                    <div className="font-mono-tabular text-[11px] text-slate-400 mt-1">
                      {member.deviceId} · Expires {new Date(member.expiresAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs mt-1">
                      {member.revoked ? (
                        <span className="text-red-400 font-semibold">Revoked · Excluded from keys</span>
                      ) : (
                        <span className="text-emerald-300">Active · Grant {member.grantPeriod}</span>
                      )}
                    </div>
                  </div>

                  {member.role !== 'owner' && !member.revoked && (
                    <button
                      type="button"
                      onClick={() => handleRevokeMemberDevice(member.deviceId)}
                      className="min-h-[40px] px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-xs font-semibold text-red-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: RECOVERY & DEVICE */}
        {tab === 'recovery' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <span>Encrypted Recovery Backup</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate a fresh AES-256-GCM encrypted backup kit for {authority.circleName}. Private
                keys never leave your device in plaintext.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <label htmlFor="dash-recovery-pass" className="sr-only">
                  {t.recoveryPassphraseLabel}
                </label>
                <input
                  id="dash-recovery-pass"
                  type="password"
                  value={recPass}
                  onChange={(e) => setRecPass(e.target.value)}
                  placeholder="Passphrase (8+ chars)"
                  className="flex-1 min-h-[44px] rounded-xl bg-white/[0.04] border border-white/10 px-3 text-xs text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleDownloadNewRecoveryKit}
                  className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Export Kit</span>
                </button>
              </div>
              {recFeedback && (
                <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{recFeedback}</span>
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-red-500/[0.07] border border-red-400/20 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                <span>Decommission / Reset This Device</span>
              </div>
              <p className="text-xs text-slate-400">
                Clears local enrollment and non-extractable keys from this browser and returns to
                the enrollment gate.
              </p>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-xs font-semibold text-red-200 self-start cursor-pointer"
                >
                  Reset Local Device Enrollment
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onResetLocalDevice()}
                    className="min-h-[42px] px-4 rounded-xl bg-red-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Lock & Clear Keys
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[42px] px-3 rounded-xl bg-white/[0.06] text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-400/25 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
      </div>
    </BottomSheetModal>
  );
}
