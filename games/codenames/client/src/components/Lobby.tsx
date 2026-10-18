import { useState, type FormEvent } from 'react';
import {
  DIFFICULTIES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_WORDS_EACH,
  PLAYER_WORD_MAX,
  TOKENS,
  checkPlayerWord,
  type Lang,
} from '@codenames/engine';
import type { RoomView } from '@codenames/server/protocol';
import { errorText, useI18n } from '../i18n';
import { api } from '../net';
import { colorOf, initialOf, nameOf } from '../format';
import { roomPath } from '../paths';
import { Chat } from './Chat';
import { CloseIcon, TypeGlyph } from './Icons';
import { Header } from './Header';

interface LobbyProps {
  room: RoomView;
  onError: (code: string) => void;
  onLeave: () => void;
}

export function Lobby({ room, onError, onLeave }: LobbyProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === room.you;
  const link = `${location.origin}${roomPath(room.code)}`;
  const enough = room.players.length >= MIN_PLAYERS;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the link is still selectable in the field.
    }
  };

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok && r.error) onError(r.error);
  };
  const setLang = (lang: Lang) => run(api.settings({ lang }));

  return (
    <div className="app">
      <Header />
      <div className="lobby">
        <div className="lobby-main">
          <div>
            <h1>
              {t('room')} <span className="mono">{room.code}</span>
            </h1>
            <p className="muted">{t('lobbyIntro')}</p>
          </div>
          <div className="link-row">
            <label htmlFor="room-link" className="sr-only">
              {t('roomLink')}
            </label>
            <input id="room-link" className="mono" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn outline" onClick={copy}>
              {copied ? t('copied') : t('copyLink')}
            </button>
          </div>

          <section className="card stack">
            <h2 id="lang-title">{t('wordLang')}</h2>
            <div className="seg" role="group" aria-labelledby="lang-title">
              {(['en', 'zh'] as Lang[]).map((l) => (
                <button key={l} type="button" aria-pressed={room.lang === l} disabled={!isHost} onClick={() => setLang(l)}>
                  {l === 'en' ? 'English' : '中文'}
                </button>
              ))}
            </div>
            <p className="muted small">{isHost ? t('wordLangNote') : t('wordLangHost')}</p>
            <div className="setup-line">
              <span>
                <TypeGlyph type="agent" size={10} /> {t('setupAgents')}
              </span>
              <span>
                <span className="token-dot" aria-hidden="true" /> {t('setupTokens', { n: TOKENS[room.difficulty] })}
              </span>
              <span>
                <TypeGlyph type="assassin" size={10} /> {t('setupAssassin')}
              </span>
            </div>
          </section>

          <section className="card stack">
            <h2 id="level-title">{t('difficulty')}</h2>
            <div className="levels" role="group" aria-labelledby="level-title">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="level"
                  aria-pressed={room.difficulty === d}
                  disabled={!isHost}
                  onClick={() => run(api.settings({ difficulty: d }))}
                >
                  <span className="level-name">{t(`level.${d}`)}</span>
                  <span className="level-tokens">
                    <span className="mono strong">{TOKENS[d]}</span> {t('tokensUnit')}
                  </span>
                  <span className="muted small">{t(`level.${d}.note`)}</span>
                </button>
              ))}
            </div>
            {!isHost && <p className="muted small">{t('difficultyHost')}</p>}
          </section>

          {room.lang === 'zh' && <MyWords room={room} onError={onError} />}

          <section className="card how">
            <h2>{t('howTitle')}</h2>
            <p>
              <strong>{t('howGoalLabel')}</strong> {t('howGoal')}
            </p>
            <p>
              <strong>{t('howClueLabel')}</strong> {t('howClue')}
            </p>
            <p>
              <strong>{t('howGuessLabel')}</strong> {t('howGuess')}
            </p>
          </section>
        </div>

        <aside className="lobby-side">
          <section className="card stack">
            <div className="row-between">
              <h2>{t('players')}</h2>
              <span className="muted">
                <strong className="mono strong">{room.players.length}</strong> / {MAX_PLAYERS}
              </span>
            </div>
            {room.players.map((p) => {
              const spy = p.id === room.spymaster;
              return (
                <div key={p.id} className={spy ? 'seat spy' : 'seat'}>
                  <span className="avatar-dot" style={{ background: spy ? 'var(--gold)' : colorOf(room, p.id) }} aria-hidden="true">
                    {initialOf(p.name)}
                  </span>
                  <span className="seat-name">{p.name}</span>
                  <span className="muted small">
                    {!p.connected
                      ? t('reconnecting')
                      : [p.id === room.hostId && t('host'), p.id === room.you && t('youTag')].filter(Boolean).join(' · ')}
                  </span>
                  {isHost ? (
                    <button
                      type="button"
                      className={spy ? 'spy-btn on' : 'spy-btn'}
                      aria-pressed={spy}
                      onClick={() => run(api.settings({ spymaster: p.id }))}
                    >
                      {spy ? t('spymaster') : t('makeSpymaster')}
                    </button>
                  ) : (
                    spy && <span className="spy-btn on">{t('spymaster')}</span>
                  )}
                </div>
              );
            })}
            {isHost && (
              <button type="button" className="btn dashed" onClick={() => run(api.settings({ spymaster: 'random' }))}>
                {t('randomSpymaster')}
              </button>
            )}
          </section>
          {isHost ? (
            <>
              <button type="button" className="btn primary big" disabled={!enough} onClick={() => run(api.start())}>
                {t('start')}
              </button>
              <p className="muted small center">
                {enough ? t('startNote', { name: nameOf(room, room.spymaster) }) : t('needTwo')}
              </p>
            </>
          ) : (
            <p className="muted center">{t('waitHost', { name: nameOf(room, room.hostId) })}</p>
          )}
          <div className="card chat-card">
            <Chat room={room} onError={onError} />
          </div>
          <button type="button" className="btn link" onClick={onLeave}>
            {t('leave')}
          </button>
        </aside>
      </div>
    </div>
  );
}

/** Up to 3 words of your own for the next board (Chinese rooms). */
function MyWords({ room, onError }: { room: RoomView; onError: (code: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const { mine, count, all } = room.words;
  const full = mine.length >= PLAYER_WORDS_EACH;
  const valid = checkPlayerWord(draft) !== null;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return setError(t('err.WORD_INVALID'));
    const r = await api.addWord(draft);
    if (r.ok) {
      setDraft('');
      setError(undefined);
    } else setError(errorText(t, r.error));
  };
  const remove = async (word: string) => {
    const r = await api.removeWord(word);
    if (!r.ok) onError(r.error);
  };

  return (
    <section className="card stack" aria-labelledby="words-title">
      <div className="row-between">
        <h2 id="words-title">{t('myWords')}</h2>
        <span className="muted small">{t('myWordsNote', { n: PLAYER_WORDS_EACH })}</span>
      </div>
      {mine.length > 0 && (
        <ul className="word-list">
          {mine.map((w) => (
            <li key={w}>
              <span className="word-pill">{w}</span>
              <button type="button" className="icon-btn" aria-label={t('removeWord', { word: w })} onClick={() => remove(w)}>
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <form className="word-form" onSubmit={add}>
          <label htmlFor="new-word" className="sr-only">
            {t('newWord')}
          </label>
          <input
            id="new-word"
            lang="zh"
            value={draft}
            maxLength={PLAYER_WORD_MAX + 2}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'word-error' : undefined}
            placeholder={t('newWordPlaceholder', { n: mine.length + 1 })}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(undefined);
            }}
          />
          <button className="btn primary" disabled={!draft.trim()}>
            {t('add')}
          </button>
        </form>
      )}
      {error && (
        <p id="word-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">{t('wordsCount', { n: count })}</p>
      {all && all.length > 0 && (
        <div className="stack host-words">
          <span className="muted small">{t('hostWords')}</span>
          <ul className="word-list">
            {all.map(({ word, by }) => (
              <li key={word}>
                <span className="word-pill">{word}</span>
                <span className="muted small">{nameOf(room, by)}</span>
                <button type="button" className="icon-btn" aria-label={t('removeWord', { word })} onClick={() => remove(word)}>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
