/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.VIDEOSNAPCARD
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\VideoSnapCard.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/VideoSnapCard.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState } from 'react';
import { Film, Play, Plus } from 'lucide-react';
import { formatDuration, type VideoSnap } from '../utils/circleLogic';
import type { Translations } from '../utils/i18n';
import { Avatar } from './Avatar';

interface VideoSnapCardProps {
  t: Translations;
  snaps: VideoSnap[];
  onOpenSnap: (snap: VideoSnap) => void;
  onOpenNewSnap: () => void;
}

export function VideoSnapCard({
  t,
  snaps,
  onOpenSnap,
  onOpenNewSnap,
}: VideoSnapCardProps) {
  const [imgErrorIds, setImgErrorIds] = useState<Record<string, boolean>>({});
  const featured = snaps[0];

  return (
    <section
      aria-label={t.videoSnapTitle}
      className="rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-4 sm:p-5 flex flex-col gap-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-base font-bold tracking-tight text-slate-100 truncate">
            {t.videoSnapTitle}
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenNewSnap}
          className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span>{t.newSnap.replace(/^\+\s*/, '')}</span>
        </button>
      </div>

      {!featured ? (
        <div className="py-8 text-center text-xs text-slate-400 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          {t.emptySnaps}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onOpenSnap(featured)}
            className="group relative w-full h-44 sm:h-48 rounded-2xl overflow-hidden border border-white/[0.08] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {!imgErrorIds[featured.id] ? (
              <img
                src={featured.thumbnailUrl}
                alt={featured.title}
                referrerPolicy="no-referrer"
                onError={() =>
                  setImgErrorIds((prev) => ({ ...prev, [featured.id]: true }))
                }
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#17283D] to-[#0D1520] flex items-center justify-center">
                <Film className="w-10 h-10 text-sky-400/70" aria-hidden="true" />
              </div>
            )}

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10"
            />

            <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-sm sm:text-base font-bold text-white truncate">
                  {featured.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/90 mt-1">
                  <Avatar name={featured.sender} src={featured.avatarUrl} size="sm" />
                  <span className="truncate">{featured.sender}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular shrink-0">
                    {formatDuration(featured.durationSec)}
                  </span>
                  {featured.queued && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300 shrink-0">{t.queuedTag}</span>
                    </>
                  )}
                </div>
              </div>

              <span className="min-h-[40px] px-3.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-lg">
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                <span>{t.openSnap}</span>
              </span>
            </div>
          </button>

          {snaps.length > 1 && (
            <div className="flex flex-col divide-y divide-white/[0.05]">
              {snaps.slice(1, 3).map((snap) => (
                <button
                  key={snap.id}
                  type="button"
                  onClick={() => onOpenSnap(snap)}
                  className="py-2 min-h-[56px] flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] rounded-xl px-2 -mx-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={snap.thumbnailUrl}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {snap.title}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {snap.sender} · {snap.timeLabel}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs text-slate-400 shrink-0">
                    {formatDuration(snap.durationSec)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
