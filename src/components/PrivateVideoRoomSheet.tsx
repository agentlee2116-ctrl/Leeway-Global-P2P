/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.PRIVATEVIDEOROOMSHEET
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\PrivateVideoRoomSheet.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/PrivateVideoRoomSheet.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useEffect, useState } from 'react';
import { Hand, LayoutGrid, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { formatDuration } from '../utils/circleLogic';
import type { Translations } from '../utils/i18n';
import { Avatar } from './Avatar';
import { BottomSheetModal } from './BottomSheetModal';

interface PrivateVideoRoomSheetProps {
  t: Translations;
  open: boolean;
  circleId: string;
  userName: string;
  roomLive: boolean;
  onToggleRoomLive: () => void;
  onClose: () => void;
}

export function PrivateVideoRoomSheet({
  t,
  open,
  circleId,
  userName,
  roomLive,
  onToggleRoomLive,
  onClose,
}: PrivateVideoRoomSheetProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const [liveSec, setLiveSec] = useState(0);

  useEffect(() => {
    if (!roomLive) {
      setLiveSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLiveSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [roomLive]);

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title={t.roomModalTitle}
      closeLabel={t.close}
    >
      <p className="text-xs text-slate-400 leading-relaxed">{t.roomModalSub}</p>

      <div className="rounded-2xl bg-[#080B0F] border border-white/[0.08] p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono-tabular text-slate-200">{circleId}</span>
            {roomLive && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-sky-300 font-semibold">
                  {formatDuration(liveSec)}
                </span>
              </>
            )}
          </div>
          <span className={roomLive ? 'text-sky-300 font-semibold' : 'text-slate-400'}>
            {roomLive ? t.roomLive : t.roomStandby}
          </span>
        </div>

        <div className={`grid gap-3 ${spotlight ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div
            className={`rounded-2xl bg-[#121822] border p-4 flex flex-col items-center justify-center gap-2.5 min-h-[128px] transition-colors ${
              handRaised ? 'border-amber-400/50' : 'border-white/[0.07]'
            }`}
          >
            <Avatar
              name={userName}
              src="./src/assets/images/avatar_leonard_1795518769606.jpg"
              size="lg"
            />
            <div className="text-center">
              <div className="text-xs font-semibold text-slate-100">
                {userName} {handRaised ? '✋' : ''}
              </div>
              <div className="text-[11px] text-slate-400">
                {camOff ? 'Camera paused' : roomLive ? 'Live video' : 'Ready'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#121822] border border-white/[0.07] p-4 flex flex-col items-center justify-center gap-2.5 min-h-[128px]">
            <Avatar
              name="Aunt Maya"
              src="./src/assets/images/avatar_maya_1795518769059.jpg"
              size="lg"
            />
            <div className="text-center">
              <div className="text-xs font-semibold text-slate-100">Aunt Maya</div>
              <div className="text-[11px] text-slate-400">
                {roomLive ? 'Joined circle room' : 'Standby'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMicMuted((m) => !m)}
            aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
              micMuted
                ? 'bg-red-500/20 border-red-400/40 text-red-200'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setCamOff((c) => !c)}
            aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}
            className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
              camOff
                ? 'bg-red-500/20 border-red-400/40 text-red-200'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
            }`}
          >
            {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setHandRaised((h) => !h)}
            aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
            className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
              handRaised
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setSpotlight((s) => !s)}
            aria-label="Toggle layout"
            className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
              spotlight
                ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleRoomLive}
          className={`min-h-[44px] px-5 rounded-xl font-display text-xs font-bold whitespace-nowrap cursor-pointer ${
            roomLive
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
          }`}
        >
          {roomLive ? t.endVideoSession : t.startVideoSession}
        </button>
      </div>
    </BottomSheetModal>
  );
}
