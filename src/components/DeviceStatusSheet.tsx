/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.DEVICESTATUSSHEET
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\DeviceStatusSheet.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/DeviceStatusSheet.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState } from 'react';
import { Lock, ShieldCheck, Volume2 } from 'lucide-react';
import type { EnrollmentSession } from '../utils/circleStore';
import type { DeviceKeyRecord } from '../utils/enrollmentCrypto';
import type { Translations } from '../utils/i18n';
import { BottomSheetModal } from './BottomSheetModal';

interface DeviceStatusSheetProps {
  t: Translations;
  open: boolean;
  session: EnrollmentSession;
  keys: DeviceKeyRecord;
  soundEnabled: boolean;
  autoPlayWalkie: boolean;
  onToggleSound: () => void;
  onToggleAutoPlay: () => void;
  onResetLocalDevice: () => Promise<void>;
  onClose: () => void;
}

export function DeviceStatusSheet({
  t,
  open,
  session,
  keys,
  soundEnabled,
  autoPlayWalkie,
  onToggleSound,
  onToggleAutoPlay,
  onResetLocalDevice,
  onClose,
}: DeviceStatusSheetProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <BottomSheetModal
      open={open}
      title={t.deviceStatusBtn}
      subtitle={`${session.circleName} · ${t.memberRoleBadge}`}
      closeLabel={t.close}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-[#080B0F] border border-white/[0.08] flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Your Name</span>
            <span className="font-semibold text-white">{session.userName}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Family Circle</span>
            <span className="font-semibold text-amber-300">{session.circleName}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Access Status</span>
            <span className="text-emerald-300 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Approved until {new Date(session.grant.expiresAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Device Protection</span>
            <span className="text-slate-200 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              Screen lock active
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
            <span className="text-slate-400">Device Fingerprint</span>
            <span className="font-mono-tabular text-slate-300">{keys.fingerprint}</span>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#080B0F] border border-white/[0.08] overflow-hidden">
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            onClick={onToggleSound}
            className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Volume2 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-100">Walkie-Talkie Chirp Tones</div>
                <div className="text-xs text-slate-400">Audio feedback when pressing hold-to-talk</div>
              </div>
            </div>
            <span className={`text-xs font-bold ${soundEnabled ? 'text-amber-400' : 'text-slate-500'}`}>
              {soundEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={autoPlayWalkie}
            onClick={onToggleAutoPlay}
            className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">Auto-Play Incoming Voice</div>
              <div className="text-xs text-slate-400">Play new family voice bursts automatically</div>
            </div>
            <span className={`text-xs font-bold ${autoPlayWalkie ? 'text-amber-400' : 'text-slate-500'}`}>
              {autoPlayWalkie ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <div className="pt-2">
          {!confirmLeave ? (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="min-h-[44px] px-4 rounded-xl bg-red-500/12 hover:bg-red-500/20 border border-red-400/25 text-xs font-semibold text-red-200 cursor-pointer"
            >
              Lock & Remove This Device
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onResetLocalDevice()}
                className="min-h-[44px] px-4 rounded-xl bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Reset Device
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="min-h-[44px] px-3 rounded-xl bg-white/[0.06] text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </BottomSheetModal>
  );
}
