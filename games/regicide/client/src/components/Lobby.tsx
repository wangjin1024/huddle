import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_SETUP } from '@regicide/engine';
import type { RoomView } from '@regicide/server/protocol';
import { useI18n, type Translate } from '../i18n';
import { api } from '../net';
import { nameOf } from '../format';
import { roomPath } from '../paths';
import { Header } from './Header';

const COUNTS = [1, 2, 3, 4];

export const playersText = (t: Translate, n: number) => (n === 1 ? t('solo') : t('nPlayers', { n }));

export function Lobby({ room, onError, onLeave }: { room: RoomView; onError: (code: string) => void; onLeave: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === room.you;
  const link = `${location.origin}${roomPath(room.code)}`;
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => room.players[i]);
  const count = Math.min(Math.max(room.players.length, MIN_PLAYERS), MAX_PLAYERS);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the link is still selectable in the field.
    }
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

          <section className="card">
            <h2>{t('setupTitle', { n: playersText(t, count) })}</h2>
            <p className="muted small">{t('setupNote')}</p>
            <div className="levels">
              {COUNTS.map((n) => (
                <div key={n} className="level" aria-current={n === count ? 'true' : undefined}>
                  <span className="level-name">{playersText(t, n)}</span>
                  <span className="level-line">
                    {t('handLabel')} <strong className="mono strong">{PLAYER_SETUP[n]!.handSize}</strong>
                  </span>
                  <span className="level-line">
                    {t('jestersLabel')} <strong className="mono strong">{PLAYER_SETUP[n]!.jesters}</strong>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card how">
            <h2>{t('howTitle')}</h2>
            <p>
              <strong>{t('howGoalLabel')}</strong> {t('howGoal')}
            </p>
            <p>
              <strong>{t('howTurnLabel')}</strong> {t('howTurn')}
            </p>
            <p>
              <strong>{t('howHitLabel')}</strong> {t('howHit')}
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
            <p className="muted small">{t('seatNote')}</p>
          </section>
          {isHost ? (
            <>
              <button type="button" className="btn primary big" onClick={start}>
                {t('start')}
              </button>
              <p className="muted small center">{t('soloOk')}</p>
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
