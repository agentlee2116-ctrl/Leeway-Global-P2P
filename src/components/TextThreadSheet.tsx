/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.TEXTTHREADSHEET
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\components\TextThreadSheet.tsx
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/TextThreadSheet.tsx
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { TextDispatch } from '../utils/circleLogic';
import type { Translations } from '../utils/i18n';
import { Avatar } from './Avatar';
import { BottomSheetModal } from './BottomSheetModal';

interface TextThreadSheetProps {
  t: Translations;
  open: boolean;
  messages: TextDispatch[];
  onClose: () => void;
  onSendText: (body: string) => { ok: boolean; error?: string };
  onToggleReaction: (msgId: string, emoji: string) => void;
}

const QUICK_REPLIES = ['On my way 🚗', 'All good ✅', 'Talk soon 🙏'];
const MSG_REACTIONS = ['❤️', '👍', '🙏'];

export function TextThreadSheet({
  t,
  open,
  messages,
  onClose,
  onSendText,
  onToggleReaction,
}: TextThreadSheetProps) {
  const [reply, setReply] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const res = onSendText(reply);
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Message cannot be empty.');
      return;
    }
    setErrorMsg(null);
    setReply('');
  };

  return (
    <BottomSheetModal open={open} onClose={onClose} title={t.textTitle} closeLabel={t.close}>
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">{t.emptyTexts}</div>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.06]">
            {messages.map((msg) => (
              <div key={msg.id} className="py-3 flex items-start gap-3">
                <Avatar name={msg.sender} src={msg.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{msg.sender}</span>
                    <span aria-hidden="true">·</span>
                    <span>{msg.timeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className={msg.queued ? 'text-amber-300' : 'text-slate-400'}>
                      {msg.queued ? t.queuedTag : t.syncedTag}
                    </span>
                  </div>
                  <p className="text-sm text-slate-100 mt-1 leading-relaxed break-words">
                    {msg.body}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {MSG_REACTIONS.map((emoji) => {
                      const count = msg.reactions?.[emoji] ?? 0;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onToggleReaction(msg.id, emoji)}
                          aria-label={`React ${emoji} to ${msg.sender}`}
                          className={`min-h-[32px] px-2 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                            count > 0
                              ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                              : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.07] text-slate-300'
                          }`}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className="font-mono-tabular">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick 1-Tap Smartphone Replies */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.06]">
          {QUICK_REPLIES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onSendText(preset);
                setErrorMsg(null);
              }}
              className="min-h-[36px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-slate-200 cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
          <div className="flex items-center gap-2 rounded-2xl bg-[#080B0F] border border-white/[0.09] focus-within:border-amber-400/50 p-1.5">
            <label htmlFor="sheet-reply-input" className="sr-only">
              {t.placeholder}
            </label>
            <input
              id="sheet-reply-input"
              type="text"
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={t.placeholder}
              className="flex-1 min-w-0 min-h-[44px] bg-transparent text-slate-100 placeholder:text-slate-500 px-3 text-sm focus:outline-none"
            />
            <button
              type="submit"
              aria-label={t.send}
              className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.send}</span>
            </button>
          </div>
          {errorMsg && (
            <p role="alert" className="text-xs text-red-400">
              {errorMsg}
            </p>
          )}
        </form>
      </div>
    </BottomSheetModal>
  );
}
