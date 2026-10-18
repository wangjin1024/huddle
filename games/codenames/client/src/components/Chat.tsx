import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_TEXT_MAX, type RoomView } from '@codenames/server/protocol';
import { useI18n } from '../i18n';
import { api } from '../net';
import { colorOf, eventText, initialOf, nameOf, typeKey } from '../format';
import { CloseIcon, SendIcon, TypeGlyph } from './Icons';

interface ChatProps {
  room: RoomView;
  onError: (code: string) => void;
  /** In a game the chat holds this round only. */
  round?: boolean;
  /** Shown instead of the input (the Spymaster during a game). */
  silent?: string;
  /** Phone sheet: shows a close button. */
  onClose?: () => void;
}

export function Chat({ room, onError, round, silent, onClose }: ChatProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const last = room.chat.at(-1)?.seq;

  // Keep the newest line in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [last]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');
    const r = await api.chat(msg);
    if (!r.ok) {
      setText(msg);
      onError(r.error);
    }
  };

  return (
    <section className="chat" aria-labelledby="chat-title">
      <div className="chat-head">
        <h2 id="chat-title">{t('chat')}</h2>
        {round && <span className="tag">{t('thisRound')}</span>}
        <span className="spacer" />
        {room.game && (
          <span className="muted small">
            {room.game.spymaster === room.you ? t('spyReadsYou') : t('spyReads', { name: nameOf(room, room.game.spymaster) })}
          </span>
        )}
        {onClose && (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </div>
      <ol className="chat-lines" ref={list} aria-live="polite">
        {room.chat.length === 0 && <li className="muted small center chat-empty">{round ? t('chatEmptyRound') : t('chatEmpty')}</li>}
        {room.chat.map((line) => {
          if (line.kind === 'event') {
            const e = line.event;
            return (
              <li key={line.seq} className="chat-sys">
                <span className="sys-tag">{t(`sys.${e.type}`)}</span>
                <span>{eventText(t, room, e)}</span>
                {e.type === 'revealed' && (
                  <span className={`word-chip type-${e.card}`}>
                    <TypeGlyph type={e.card} size={10} label={t(typeKey(e.card))} />
                    {e.word}
                  </span>
                )}
              </li>
            );
          }
          const mine = line.from === room.you;
          const name = nameOf(room, line.from);
          return (
            <li key={line.seq} className={mine ? 'chat-msg mine' : 'chat-msg'}>
              {!mine && (
                <span className="avatar-dot" style={{ background: colorOf(room, line.from) }} aria-hidden="true">
                  {initialOf(name)}
                </span>
              )}
              <div className="chat-body">
                {!mine && <span className="chat-name">{name}</span>}
                <span className="bubble">{line.text}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {round && <p className="muted small chat-note">{t('chatClears')}</p>}
      {silent ? (
        <p className="chat-silent">{silent}</p>
      ) : (
        <form className="chat-form" onSubmit={send}>
          <label htmlFor="chat-input" className="sr-only">
            {t('message')}
          </label>
          <input
            id="chat-input"
            value={text}
            maxLength={CHAT_TEXT_MAX}
            autoComplete="off"
            placeholder={t('chatPlaceholder')}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn primary send" aria-label={t('send')} disabled={!text.trim()}>
            <SendIcon />
          </button>
        </form>
      )}
    </section>
  );
}
