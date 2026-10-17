import { useState } from 'react';
import { DIFFICULTY, MAX_PLAYERS, MIN_PLAYERS, type Difficulty } from '@bomb-busters/engine';
import type { RoomView } from '@bomb-busters/server/protocol';
import { useI18n, type Translate } from '../i18n';
import { api } from '../net';
import { nameOf } from '../format';
import { Header } from './Header';

const LEVELS: Difficulty[] = ['simple', 'medium', 'hard'];

export const redText = (t: Translate, n: number) => (n === 1 ? t('redOne') : t('redMany', { n }));
export const yellowText = (t: Translate, n: number) => (n === 0 ? t('yellowNone') : t('yellowMany', { n }));

export function Lobby({ room, onError, onLeave }: { room: RoomView; onError: (code: string) => void; onLeave: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === room.you;
  const link = `${location.origin}/r/${room.code}`;
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => room.players[i]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the link is still selectable in the field.
    }
  };

  const pick = async (d: Difficulty) => {
    const r = await api.setDifficulty(d);
    if (!r.ok) onError(r.error);
  };
  const start = async () => {
    const r = await api.start();
    if (!r.ok) onError(r.error);
  };

  return (
    <div className="app">
      <Header />
      <div className="lobby">
        <div className="lobby-main">
          <div>
            <h1>
              {t('room')} {room.code}
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

          <section className="card">
            <h2>{t('difficultyTitle')}</h2>
            <p className="muted small">{t('difficultyNote')}</p>
            <div className="levels">
              {LEVELS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="level"
                  aria-pressed={room.difficulty === d}
                  disabled={!isHost}
                  onClick={() => pick(d)}
                >
                  <span className="level-name">{t(`difficulty.${d}`)}</span>
                  <span className="level-line">
                    <span className="dot dot-red" />
                    {redText(t, DIFFICULTY[d].red)}
                  </span>
                  <span className="level-line">
                    <span className={DIFFICULTY[d].yellow ? 'dot dot-yellow' : 'dot dot-off'} />
                    {yellowText(t, DIFFICULTY[d].yellow)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card how">
            <h2>{t('howTitle')}</h2>
            <p>
              <strong>{t('howDualLabel')}</strong> {t('howDual')}
            </p>
            <p>
              <strong>{t('howSoloLabel')}</strong> {t('howSolo')}
            </p>
            <p>
              <strong>{t('howEndLose')}</strong> {t('howEndLoseText')} <strong>{t('howEndWin')}</strong>{' '}
              {t('howEndWinText')}
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
            {seats.map((p, i) => (
              <div key={p?.id ?? `open-${i}`} className={p ? 'seat' : 'seat open'}>
                <span className="mono seat-no">{i + 1}</span>
                <span className="seat-name">{p ? p.name : t('openSeat')}</span>
                <span className="muted small">
                  {p && !p.connected
                    ? t('reconnecting')
                    : p?.id === room.hostId
                      ? p.id === room.you
                        ? t('hostYou')
                        : t('host')
                      : p?.id === room.you
                        ? t('youTag')
                        : ''}
                </span>
              </div>
            ))}
            <p className="muted small">{t('seatNote', { n: room.players.length + 1 })}</p>
          </section>
          {isHost ? (
            <>
              <button
                type="button"
                className="btn primary big"
                disabled={room.players.length < MIN_PLAYERS}
                onClick={start}
              >
                {t('start', { level: t(`difficulty.${room.difficulty}`) })}
              </button>
              {room.players.length < MIN_PLAYERS && <p className="muted small center">{t('needPlayers')}</p>}
            </>
          ) : (
            <p className="muted center">{t('waitHost', { name: nameOf(room, room.hostId) })}</p>
          )}
          <button type="button" className="btn link" onClick={onLeave}>
            {t('leave')}
          </button>
        </aside>
      </div>
    </div>
  );
}
