/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.WALKIEDECK
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\WalkieDeck.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/WalkieDeck.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { Mic, Pause, Play, Radio, SlidersHorizontal } from 'lucide-react';
import { formatDuration, type VoiceBurst } from '../utils/circleLogic';
import type { Translations } from '../utils/i18n';
import { Avatar } from './Avatar';

interface WalkieDeckProps {
  t: Translations;
  circleId: string;
  circleName: string;
  canTalk?: boolean;
  recording: boolean;
  recSeconds: number;
  onStartRec: () => void;
  onStopRec: () => void;
  bursts: VoiceBurst[];
  playingBurstId: string | null;
  playbackProgress: number;
  onTogglePlayBurst: (burst: VoiceBurst) => void;
  onOpenSetup: () => void;
}

export function WalkieDeck({
  t,
  circleId,
  circleName,
  canTalk = true,
  recording,
  recSeconds,
  onStartRec,
  onStopRec,
  bursts,
  playingBurstId,
  playbackProgress,
  onTogglePlayBurst,
  onOpenSetup,
}: WalkieDeckProps) {
  return (
    <section
      aria-label={t.walkieTitle}
      className="h-full rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-4 sm:p-6 flex flex-col justify-between gap-5"
    >
      {/* Sleek Handset Top Speaker Notch & Channel Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-center" aria-hidden="true">
          <div className="w-14 h-1 rounded-full bg-white/10" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-100 truncate">
                {t.walkieTitle}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              <span>{circleName}</span>
              <span aria-hidden="true"> · </span>
              <span className="font-mono-tabular text-slate-300">{circleId}</span>
              <span aria-hidden="true"> · </span>
              <span>{t.e2eeSecured}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSetup}
            aria-label={t.setupModalTitle}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-slate-300" aria-hidden="true" />
            <span className="hidden sm:inline font-mono-tabular">{circleId}</span>
          </button>
        </div>
      </div>

      {/* Precision Hardware Push-to-Talk Dial */}
      <div className="py-2 sm:py-4 flex flex-col items-center gap-4 border-y border-white/[0.06]">
        <div className="w-full flex items-center justify-between text-xs px-1">
          <span className="font-mono-tabular uppercase tracking-widest text-[11px] text-slate-400">
            {recording ? t.talking : 'PTT READY'}
          </span>
          <span
            className={`font-mono-tabular text-sm font-semibold ${
              recording ? 'text-red-400' : 'text-slate-300'
            }`}
          >
            {formatDuration(recording ? recSeconds : 0)}
          </span>
        </div>

        <div className="relative flex items-center justify-center py-2">
          {/* Concentric precision hardware ring */}
          <div
            aria-hidden="true"
            className={`w-44 h-44 sm:w-48 sm:h-48 rounded-full border transition-colors duration-200 flex items-center justify-center ${
              recording
                ? 'border-red-500/40 bg-red-500/[0.04]'
                : 'border-white/[0.07] bg-white/[0.015]'
            }`}
          />

          {recording && (
            <span
              aria-hidden="true"
              className="absolute w-48 h-48 sm:w-52 sm:h-52 rounded-full border border-red-500/55 animate-ptt-ring pointer-events-none"
            />
          )}

          <button
            type="button"
            disabled={!canTalk}
            onMouseDown={() => {
              if (canTalk) onStartRec();
            }}
            onMouseUp={() => {
              if (canTalk) onStopRec();
            }}
            onMouseLeave={() => {
              if (recording) onStopRec();
            }}
            onTouchStart={(e) => {
              if (!canTalk) return;
              e.preventDefault();
              onStartRec();
            }}
            onTouchEnd={(e) => {
              if (!canTalk) return;
              e.preventDefault();
              onStopRec();
            }}
            onKeyDown={(e) => {
              if (!canTalk) return;
              if (e.key === 'Enter' && !e.repeat) {
                e.preventDefault();
                if (recording) onStopRec();
                else onStartRec();
              }
            }}
            aria-pressed={recording}
            className={`absolute z-10 w-36 h-36 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-150 select-none touch-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 ${
              !canTalk
                ? 'bg-white/[0.06] text-slate-400 cursor-not-allowed border border-white/10'
                : recording
                ? 'bg-gradient-to-b from-red-500 to-red-600 text-white scale-[0.95] cursor-pointer shadow-[0_14px_38px_rgba(239,68,68,0.4),inset_0_1px_1px_rgba(255,255,255,0.35)]'
                : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 active:scale-[0.95] cursor-pointer shadow-[0_14px_34px_rgba(245,158,11,0.22),inset_0_1px_1px_rgba(255,255,255,0.5)]'
            }`}
          >
            <Mic
              className={`w-7 h-7 ${recording ? 'animate-pulse' : ''}`}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span className="font-display text-[11px] sm:text-xs font-extrabold tracking-wider text-center px-3 leading-tight">
              {!canTalk
                ? 'PTT RESTRICTED'
                : recording
                ? `${t.talking} ${formatDuration(recSeconds)}`
                : t.holdToTalk}
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
          {t.pttHint}
        </p>
      </div>

      {/* Recent Voice Bursts List */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between pb-2 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Recent Bursts</span>
          <span className="font-mono-tabular text-slate-400">{bursts.length}</span>
        </div>

        {bursts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">{t.emptyVoices}</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {bursts.slice(0, 4).map((burst) => {
              const isPlaying = playingBurstId === burst.id;
              return (
                <div
                  key={burst.id}
                  className="py-2.5 flex items-center justify-between gap-3 min-h-[60px]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar name={burst.sender} src={burst.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {burst.sender}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span>{burst.timeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className={burst.queued ? 'text-amber-300' : 'text-slate-400'}>
                          {burst.queued ? t.queuedTag : t.syncedTag}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sleek Micro Waveform */}
                  <div
                    className="hidden sm:flex items-center gap-[3px] h-5 px-2"
                    aria-hidden="true"
                  >
                    {burst.waveform.map((heightPct, idx) => {
                      const barRatio = (idx + 1) / burst.waveform.length;
                      const filled = isPlaying && playbackProgress >= barRatio;
                      return (
                        <span
                          key={idx}
                          style={{ height: `${Math.max(24, heightPct)}%` }}
                          className={`w-[3px] rounded-full transition-colors duration-150 ${
                            filled ? 'bg-amber-400' : 'bg-white/15'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono-tabular text-xs text-slate-400">
                      {burst.durationLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => onTogglePlayBurst(burst)}
                      aria-label={`${isPlaying ? t.pause : t.play} voice message from ${burst.sender}`}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isPlaying
                          ? 'bg-amber-500 text-slate-950 border-transparent shadow-md'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] text-slate-100 border-white/[0.08]'
                      }`}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Play className="w-4 h-4 shrink-0 ml-0.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
