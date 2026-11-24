/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.VIDEOSNAPSHEET
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\VideoSnapSheet.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/VideoSnapSheet.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Pause,
  Play,
} from 'lucide-react';
import { formatDuration, type VideoSnap } from '../utils/circleLogic';
import type { Translations } from '../utils/i18n';
import { detectPlatform } from '../platform/index.ts';
import { bytesToBase64 } from '../core/crypto.ts';
import { BottomSheetModal } from './BottomSheetModal';

interface VideoSnapSheetProps {
  t: Translations;
  open: boolean;
  mode: 'view' | 'create';
  snap: VideoSnap | null;
  snaps: VideoSnap[];
  circleId: string;
  onSelectSnap: (snap: VideoSnap) => void;
  onToggleReaction: (snapId: string, emoji: string) => void;
  onClose: () => void;
  onCreateSnap: (params: { title: string; durationSec: number; thumbnailUrl: string; mediaBytes?: string; mime?: string }) => {
    ok: boolean;
    error?: string;
  };
}

const SNAP_PRESETS = [
  {
    label: 'Lakefront',
    url: './src/assets/images/lakefront_snap_1795518767950.jpg',
  },
  {
    label: 'Patio Dinner',
    url: './src/assets/images/family_dinner_snap_1795518768888.jpg',
  },
];

const REACTION_EMOJIS = ['❤️', '👍', '🔥', '🙏'];

export function VideoSnapSheet({
  t,
  open,
  mode,
  snap,
  snaps,
  circleId,
  onSelectSnap,
  onToggleReaction,
  onClose,
  onCreateSnap,
}: VideoSnapSheetProps) {
  const [playing, setPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5>(1);
  const [savedNotice, setSavedNotice] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(SNAP_PRESETS[0].url);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      setElapsedSec(0);
      setSavedNotice(false);
      setCreateError(null);
    }
  }, [open, mode]);

  useEffect(() => {
    setPlaying(false);
    setElapsedSec(0);
    setSavedNotice(false);
  }, [snap?.id]);

  useEffect(() => {
    if (!playing || !snap) return;
    const intervalMs = speed === 1.5 ? 667 : 1000;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => {
        if (prev + 1 >= snap.durationSec) {
          setPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [playing, snap, speed]);

  const currentIdx = snap ? snaps.findIndex((s) => s.id === snap.id) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < snaps.length - 1;

  const handleSaveClip = () => {
    if (!snap) return;
    const payload = {
      app: 'LeeWay Global P2P',
      circleId,
      clip: snap.title,
      sender: snap.sender,
      durationSec: snap.durationSec,
      e2ee: true,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leeway-snap-${snap.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedNotice(true);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let thumbnailUrl = selectedPreset;
    let durationSec = 0;
    let mediaBytes: string | undefined;
    let mime: string | undefined;
    try {
      const platform = detectPlatform();
      const handle = await platform.captureVideo();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      handle.stop();
      const burst = await handle.result;
      mediaBytes = bytesToBase64(burst.bytes);
      mime = burst.mime;
      thumbnailUrl = burst.previewUrl ?? selectedPreset;
      durationSec = Math.max(1, Math.round(burst.durationMs / 1000));
    } catch {
      // Honest fallback: no camera bytes were captured; the snaps stays metadata-only.
    }
    const res = onCreateSnap({
      title: newTitle,
      durationSec: durationSec || 1,
      thumbnailUrl,
      mediaBytes,
      mime,
    });
    if (!res.ok) {
      setCreateError(res.error ?? 'Snap title is required.');
      return;
    }
    setNewTitle('');
    setCreateError(null);
    onClose();
  };

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t.recordSnapTitle : snap?.title ?? t.videoSnapTitle}
      closeLabel={t.close}
    >
      {mode === 'create' ? (
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-snap-title" className="text-xs font-medium text-slate-300">
              {t.snapTitlePlaceholder}
            </label>
            <input
              id="new-snap-title"
              type="text"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder={t.snapTitlePlaceholder}
              className="min-h-[44px] bg-[#080B0F] text-slate-100 placeholder:text-slate-500 border border-white/12 focus:border-amber-400 rounded-xl px-3.5 text-sm focus:outline-none"
            />
            {createError && (
              <p role="alert" className="text-xs text-red-400">
                {createError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-300">Camera Preview</span>
            <div className="grid grid-cols-2 gap-3">
              {SNAP_PRESETS.map((preset) => {
                const active = selectedPreset === preset.url;
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setSelectedPreset(preset.url)}
                    className={`relative h-28 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                      active ? 'border-amber-400' : 'border-white/10 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2.5 text-xs font-semibold text-white">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[48px] w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-sm font-bold transition-colors active:scale-[0.98] cursor-pointer"
          >
            {t.captureSnapBtn}
          </button>
        </form>
      ) : snap ? (
        <div className="flex flex-col gap-4">
          <div className="relative h-56 sm:h-64 rounded-2xl overflow-hidden border border-white/12 bg-[#080B0F]">
            <img
              src={snap.thumbnailUrl}
              alt={snap.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-700 ${
                playing ? 'scale-105' : 'scale-100'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" />

            {/* Prev / Next Snap Navigation Overlay */}
            {snaps.length > 1 && (
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onSelectSnap(snaps[currentIdx - 1])}
                  aria-label="Previous snap"
                  className="pointer-events-auto min-h-[40px] min-w-[40px] rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => hasNext && onSelectSnap(snaps[currentIdx + 1])}
                  aria-label="Next snap"
                  className="pointer-events-auto min-h-[40px] min-w-[40px] rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-200">
                <span>
                  {snap.sender} · {snap.timeLabel}
                </span>
                <span className="font-mono-tabular font-semibold text-sky-300">
                  {formatDuration(elapsedSec)} / {formatDuration(snap.durationSec)}
                </span>
              </div>

              {/* Interactive Timeline Scrubber */}
              <label htmlFor="snap-scrubber" className="sr-only">
                Video timeline
              </label>
              <input
                id="snap-scrubber"
                type="range"
                min={0}
                max={snap.durationSec}
                value={elapsedSec}
                onChange={(e) => setElapsedSec(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5"
              />
            </div>
          </div>

          {/* Interactive Emoji Reactions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {REACTION_EMOJIS.map((emoji) => {
                const count = snap.reactions?.[emoji] ?? 0;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction(snap.id, emoji)}
                    aria-label={`React with ${emoji}`}
                    className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                      count > 0
                        ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-200'
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span className="font-mono-tabular">{count}</span>}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 1.5 : 1))}
              className="min-h-[40px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] font-mono-tabular text-xs font-semibold text-slate-200 cursor-pointer"
            >
              {speed}x
            </button>
          </div>

          {savedNotice && (
            <div className="text-xs text-emerald-300 flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.savedToast}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleSaveClip}
              className="min-h-[44px] px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-100 text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.saveClip}</span>
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {playing ? (
                <>
                  <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t.pause}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 shrink-0 fill-current" aria-hidden="true" />
                  <span>{t.play}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <Film className="w-8 h-8 text-slate-500" aria-hidden="true" />
          <span>{t.emptySnaps}</span>
        </div>
      )}
    </BottomSheetModal>
  );
}
