/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TEXTDISPATCHCARD
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\TextDispatchCard.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/TextDispatchCard.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState, type FormEvent } from 'react';
import { ChevronRight, MessageSquare, Mic, Send, Smile } from 'lucide-react';
import type { TextDispatch } from '../utils/circleLogic';
import type { Translations } from '../utils/i18n';
import { Avatar } from './Avatar';

interface TextDispatchCardProps {
  t: Translations;
  lang: string;
  canSend?: boolean;
  messages: TextDispatch[];
  onOpenThread: () => void;
  onSendText: (body: string) => { ok: boolean; error?: string };
}

const EMOJI_CHOICES = ['👍', '❤️', '🙏', '🚗', '✅', '👋', '📍'];

export function TextDispatchCard({
  t,
  lang,
  canSend = true,
  messages,
  onOpenThread,
  onSendText,
}: TextDispatchCardProps) {
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const latest = messages[0];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) {
      setErrorMsg('Messaging is currently restricted for this device.');
      return;
    }
    const res = onSendText(draft);
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Message cannot be empty.');
      return;
    }
    setErrorMsg(null);
    setDraft('');
    setEmojiOpen(false);
  };

  const handleDictate = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: ((ev: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: ((ev: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };

    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      document.getElementById('circle-message-input')?.focus();
      return;
    }

    try {
      const rec = new SR();
      rec.lang = lang;
      setDictating(true);
      rec.onresult = (ev) => {
        const spoken = ev.results?.[0]?.[0]?.transcript || '';
        if (spoken) {
          setDraft((prev) => (prev ? `${prev} ${spoken}` : spoken));
          setErrorMsg(null);
        }
      };
      rec.onerror = () => setDictating(false);
      rec.onend = () => setDictating(false);
      rec.start();
    } catch {
      setDictating(false);
    }
  };

  return (
    <section
      aria-label={t.textTitle}
      className="rounded-[28px] bg-gradient-to-b from-[#12171F] to-[#0C1016] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-4 sm:p-5 flex flex-col gap-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-base font-bold tracking-tight text-slate-100 truncate">
            {t.textTitle}
          </h2>
        </div>
        <span className="font-mono-tabular text-xs text-slate-400 shrink-0">
          {messages.length} msg
        </span>
      </div>

      {!latest ? (
        <div className="py-5 text-center text-xs text-slate-400 border-y border-white/[0.06]">
          {t.emptyTexts}
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenThread}
          className="w-full text-left py-3 px-2 -mx-2 rounded-2xl hover:bg-white/[0.025] border-y border-white/[0.06] transition-colors flex items-start justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar name={latest.sender} src={latest.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-semibold text-slate-200 truncate">{latest.sender}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{latest.timeLabel}</span>
                <span aria-hidden="true">·</span>
                <span className={latest.queued ? 'text-amber-300 shrink-0' : 'text-slate-400 shrink-0'}>
                  {latest.queued ? t.queuedTag : t.syncedTag}
                </span>
              </div>
              <p className="text-sm text-slate-100 mt-1 leading-relaxed break-words">
                {latest.body}
              </p>
              <span className="inline-block text-[11px] text-slate-400 mt-1">
                {t.tapToExpandText}
              </span>
            </div>
          </div>

          <ChevronRight
            className="w-4 h-4 text-slate-500 shrink-0 mt-1"
            aria-hidden="true"
          />
        </button>
      )}

      {/* Sleek Unified Smartphone Message Dock */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
        <div className="flex items-center gap-1.5 rounded-2xl bg-[#080B0F] border border-white/[0.09] focus-within:border-amber-400/50 p-1.5 transition-colors">
          <button
            type="button"
            onClick={handleDictate}
            aria-label={dictating ? t.listening : t.dictate}
            className={`min-h-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              dictating
                ? 'bg-red-500/20 text-red-200'
                : 'text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">
              {dictating ? t.listening : t.dictate}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEmojiOpen((prev) => !prev)}
            aria-label="Toggle emoji picker"
            aria-expanded={emojiOpen}
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              emojiOpen
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            <Smile className="w-4 h-4" aria-hidden="true" />
          </button>

          <label htmlFor="circle-message-input" className="sr-only">
            {t.placeholder}
          </label>
          <input
            id="circle-message-input"
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={t.placeholder}
            autoComplete="off"
            className="flex-1 min-w-0 min-h-[44px] bg-transparent text-slate-100 placeholder:text-slate-500 px-2 text-sm focus:outline-none"
          />

          <button
            type="submit"
            aria-label={t.send}
            className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{t.send}</span>
          </button>
        </div>

        {errorMsg && (
          <p role="alert" className="text-xs text-red-400 px-1">
            {errorMsg}
          </p>
        )}

        {emojiOpen && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {EMOJI_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setDraft((prev) => `${prev}${emoji}`);
                  setErrorMsg(null);
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-lg flex items-center justify-center transition-transform active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </form>
    </section>
  );
}
