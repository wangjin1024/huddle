import { useEffect, useState } from 'react';
import { DIFFICULTY, type GameView, type PlayerView } from '@bomb-busters/engine';
import type { ClientAction, RoomView } from '@bomb-busters/server/protocol';
import { useI18n } from '../i18n';
import { api } from '../net';
import { guessOfView, guessText, logText, logTone, nameOf, sortGuesses } from '../format';
import { Header } from './Header';
import { BombIcon, ScissorsIcon } from './Icons';
import { Result } from './Result';
import { Wire } from './Wire';

interface GameProps {
  room: RoomView;
  onError: (code: string) => void;
  onLeave: () => void;
}

export function Game({ room, onError, onLeave }: GameProps) {
  const { t } = useI18n();
  const game = room.game!;
  const me = game.players.find((p) => p.id === room.you)!;
  const seat = game.players.indexOf(me);
  // Teammates clockwise from you, so the next player is first.
  const teammates = [...game.players.slice(seat + 1), ...game.players.slice(0, seat)];
  const over = game.phase === 'won' || game.phase === 'lost';
  const myTurn = game.phase === 'playing' && game.currentPlayer === room.you;
  const current = room.players.find((p) => p.id === game.currentPlayer);
  const nextId = game.players[(game.players.findIndex((p) => p.id === game.currentPlayer) + 1) % game.players.length]!.id;

  // A cut is chosen as: a teammate's wire (target) + one of your own wires (armed).
  // The armed wire's value is the guess, and it is the wire of yours that gets cut.
  const [target, setTarget] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(true);

  // Every new event invalidates a half-made selection.
  useEffect(() => {
    setTarget(null);
    setArmed(null);
  }, [room.log.length, game.phase]);
  useEffect(() => setShowResult(true), [game.phase]);

  async function send(action: ClientAction) {
    setBusy(true);
    const r = await api.act(action);
    setBusy(false);
    if (!r.ok) onError(r.error);
  }

  const armedWire = armed ? me.rack.find((w) => w.id === armed) : undefined;
  const guess = armedWire ? guessOfView(armedWire) : null;
  const targetOwner = target ? game.players.find((p) => p.rack.some((w) => w.id === target)) : undefined;
  const targetNumber = targetOwner ? targetOwner.rack.findIndex((w) => w.id === target) + 1 : 0;
  const canCut = myTurn && !busy && target !== null && guess !== null && game.legal.dualCut.includes(guess);
  const canSolo = myTurn && !busy && guess !== null && game.legal.soloCut.includes(guess);

  const confirmCut = () => {
    if (canCut) void send({ type: 'dualCut', targetWireId: target!, guess: guess!, ownWireId: armed! });
  };

  const cutLabel =
    targetOwner && guess !== null
      ? t('confirmCut', { name: nameOf(room, targetOwner.id), n: targetNumber, v: guessText(t, guess) })
      : target
        ? t('pickYours')
        : t('pickTarget');

  return (
    <div className="app">
      <Header>
        <div className="room-meta">
          <span className="muted small">{t('room')}</span>
          <span className="code mono">{room.code}</span>
          <span className={`chip chip-${game.difficulty}`}>
            {t('diffChip', {
              level: t(`difficulty.${game.difficulty}`),
              red: DIFFICULTY[game.difficulty].red,
              yellow: DIFFICULTY[game.difficulty].yellow,
            })}
          </span>
        </div>
        <Detonator game={game} />
      </Header>

      <div className="table">
        <main className="table-main">
          {game.phase === 'reveal' && (
            <div className="banner reveal-banner" role="status">
              <div className="reveal-specials">
                <strong>{t('inPlayTitle')}</strong>
                <InPlay game={game} />
              </div>
              <div>
                <strong>{t('revealTitle')}</strong>{' '}
                <span>
                  {me.revealDone
                    ? t('revealWaiting', {
                        done: game.players.filter((p) => p.revealDone).length,
                        total: game.players.length,
                      })
                    : t('revealHint')}
                </span>
              </div>
            </div>
          )}
          {game.phase === 'playing' && !myTurn && current && (
            <div className={current.connected ? 'banner' : 'banner warn'} role="status">
              {current.connected ? t('waitingFor', { name: current.name }) : t('paused', { name: current.name })}
            </div>
          )}

          {teammates.map((p) => (
            <TeammateRack
              key={p.id}
              room={room}
              player={p}
              isCurrent={p.id === game.currentPlayer && game.phase === 'playing'}
              isNext={p.id === nextId && game.phase === 'playing'}
              selectable={myTurn && game.legal.dualCut.length > 0}
              target={target}
              onPick={(id) => setTarget(id === target ? null : id)}
            />
          ))}

          <section className={myTurn ? 'my-panel active' : 'my-panel'}>
            <div className="rack-head">
              <span className="avatar me">{nameOf(room, room.you)[0]}</span>
              <span className="rack-name">
                {nameOf(room, room.you)} {t('you')}
              </span>
              {myTurn && <span className="turn-chip">{t('yourTurn')}</span>}
              <span className="muted small">{t('wiresLeft', { n: me.rack.filter((w) => !w.cut).length })}</span>
            </div>
            <div className="rack-scroll">
              <div className="rack rack-lg">
                {me.rack.map((w, i) => {
                  const revealPick = game.phase === 'reveal' && !me.revealDone && w.color === 'blue';
                  // Red wires can't be named, so they can't be armed.
                  const armPick = myTurn && !game.legal.mustPass && !w.cut && w.color !== 'red';
                  return (
                    <Wire
                      key={w.id}
                      wire={w}
                      number={i + 1}
                      size="lg"
                      label={t('yourWireLabel', { n: i + 1 })}
                      pickable={revealPick}
                      armed={armed === w.id}
                      onPick={
                        revealPick
                          ? () => void send({ type: 'reveal', wireId: w.id })
                          : armPick
                            ? () => setArmed(armed === w.id ? null : w.id)
                            : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>

            {myTurn && (
              <div className="actions">
                {game.legal.mustPass ? (
                  <div className="action-col">
                    <p>{t('noMoves')}</p>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => void send({ type: 'pass' })}>
                      {t('pass')}
                    </button>
                  </div>
                ) : (
                  <div className="action-col grow">
                    <span className="muted small">{t('cutHint')}</span>
                    <div className="confirm-row">
                      <button type="button" className="btn danger" disabled={!canCut} onClick={confirmCut}>
                        <ScissorsIcon />
                        {cutLabel}
                      </button>
                      {canSolo && (
                        <button
                          type="button"
                          className="btn outline"
                          onClick={() => void send({ type: 'soloCut', value: guess! })}
                        >
                          {guess === 'yellow' ? t('soloCutYellow') : t('soloCut', { v: guess! })}
                        </button>
                      )}
                    </div>
                    <span className="muted small">{t('warning')}</span>
                    {game.legal.soloCut.length > 0 && !canSolo && (
                      <span className="small solo-note">
                        {t('soloAvail', { list: sortGuesses(game.legal.soloCut).map((g) => guessText(t, g)).join(', ') })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="table-side">
          <section className="card">
            <h2>{t('inPlayTitle')}</h2>
            <InPlay game={game} />
          </section>
          <Tally game={game} />
          <section className="card log">
            <h2>{t('log')}</h2>
            {room.log.length === 0 && <p className="muted small">{t('logEmpty')}</p>}
            <ol>
              {[...room.log].reverse().map((e) => (
                <li key={e.seq}>
                  <span className={`log-dot tone-${logTone(e)}`} />
                  <span>{logText(t, room, e)}</span>
                </li>
              ))}
            </ol>
          </section>
          {over && !showResult && (
            <button type="button" className="btn primary" onClick={() => setShowResult(true)}>
              {t('showResult')}
            </button>
          )}
        </aside>
      </div>

      {over && showResult && (
        <Result
          room={room}
          onPlayAgain={async () => {
            const r = await api.playAgain();
            if (!r.ok) onError(r.error);
          }}
          onViewRacks={() => setShowResult(false)}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}

/** The red and yellow wire values announced at setup (owners stay hidden). */
function InPlay({ game }: { game: GameView }) {
  const { t } = useI18n();
  return (
    <div className="in-play">
      <span className="in-play-label">{t('inPlayBombs')}</span>
      {game.inPlay.red.map((v) => (
        <span key={`r${v}`} className="special special-red">
          <BombIcon size={14} color="var(--red)" strokeWidth={2.4} />
          <span className="mono">{v.toFixed(1)}</span>
        </span>
      ))}
      <span className="in-play-label">{t('yellow')}</span>
      {game.inPlay.yellow.length === 0 ? (
        <span className="muted small">{t('none')}</span>
      ) : (
        game.inPlay.yellow.map((v) => (
          <span key={`y${v}`} className="special special-yellow">
            <span className="mono">{v.toFixed(1)}</span>
          </span>
        ))
      )}
    </div>
  );
}

function TeammateRack(props: {
  room: RoomView;
  player: PlayerView;
  isCurrent: boolean;
  isNext: boolean;
  selectable: boolean;
  target: string | null;
  onPick: (wireId: string) => void;
}) {
  const { t } = useI18n();
  const { room, player, isCurrent, isNext, selectable, target, onPick } = props;
  const name = nameOf(room, player.id);
  const connected = room.players.find((p) => p.id === player.id)?.connected ?? false;
  const hasTarget = player.rack.some((w) => w.id === target);
  return (
    <section className={hasTarget ? 'rack-card focus' : 'rack-card'}>
      <div className="rack-head">
        <span className="avatar">{name[0]}</span>
        <span className="rack-name">{name}</span>
        <span className="muted small">{t('wiresLeft', { n: player.rack.filter((w) => !w.cut).length })}</span>
        {isCurrent && <span className="pill">{t('turnNow')}</span>}
        {!isCurrent && isNext && <span className="pill">{t('nextTurn')}</span>}
        {!connected && <span className="pill warn">{t('reconnecting')}</span>}
      </div>
      <div className="rack-scroll">
        <div className="rack rack-sm">
          {player.rack.map((w, i) => (
            <Wire
              key={w.id}
              wire={w}
              number={i + 1}
              size="sm"
              label={`${t('wireLabel', { name, n: i + 1 })}${w.color ? '' : `, ${t('hiddenWire')}`}`}
              selected={target === w.id}
              onPick={selectable && !w.cut ? () => onPick(w.id) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Detonator({ game }: { game: GameView }) {
  const { t } = useI18n();
  const exploded = game.lossReason === 'detonator';
  return (
    <div className="detonator">
      <div className="row-between small">
        <span className="muted">{t('detonator')}</span>
        <span>
          <strong className="mono">
            {Math.min(game.mistakes, game.mistakesAllowed)} / {game.mistakesAllowed}
          </strong>{' '}
          <span className="muted">{t('mistakes')}</span>
        </span>
      </div>
      <div
        className="det-bars"
        role="img"
        aria-label={t('detonatorLabel', { used: game.mistakes, allowed: game.mistakesAllowed })}
      >
        {Array.from({ length: game.mistakesAllowed }, (_, i) => (
          <span key={i} className={i < game.mistakes ? 'det-bar on' : 'det-bar'} />
        ))}
        <span className={exploded ? 'det-bomb on' : 'det-bomb'}>
          <BombIcon size={12} color={exploded ? '#fff' : 'var(--red)'} strokeWidth={2.4} />
        </span>
      </div>
    </div>
  );
}

function Tally({ game }: { game: GameView }) {
  const { t } = useI18n();
  const cut = Object.values(game.blueCut).reduce((a, b) => a + b, 0) + game.yellowCut;
  return (
    <section className="card">
      <div className="row-between">
        <h2>{t('cutWires')}</h2>
        <span className="muted small">
          <strong className="mono strong">{cut}</strong> / {48 + game.yellowTotal}
        </span>
      </div>
      <div className="tally">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
          <div key={v} className="tally-cell" aria-label={`${v}: ${game.blueCut[v]} / 4`}>
            <span className="mono">{v}</span>
            <span className="pips" aria-hidden="true">
              {[0, 1, 2, 3].map((k) => (
                <span key={k} className={k < (game.blueCut[v] ?? 0) ? 'pip on' : 'pip'} />
              ))}
            </span>
          </div>
        ))}
      </div>
      {game.yellowTotal > 0 && (
        <p className="yellow-line small">
          <span className="dot dot-yellow" /> {t('yellowCut', { cut: game.yellowCut, total: game.yellowTotal })}
        </p>
      )}
    </section>
  );
}
