import { useEffect, useMemo, useState } from 'react';
import { DIFFICULTY, type GameView, type Guess, type PlayerView } from '@bomb-busters/engine';
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

  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [ownWire, setOwnWire] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(true);

  // Every new event invalidates a half-made selection.
  useEffect(() => {
    setTarget(null);
    setGuess(null);
    setOwnWire(null);
  }, [room.log.length, game.phase]);
  useEffect(() => setShowResult(true), [game.phase]);

  const candidates = useMemo(
    () => (guess === null ? [] : me.rack.filter((w) => !w.cut && guessOfView(w) === guess)),
    [guess, me.rack],
  );
  const needOwn = candidates.length > 1 && ownWire === null;

  async function send(action: ClientAction) {
    setBusy(true);
    const r = await api.act(action);
    setBusy(false);
    if (!r.ok) onError(r.error);
  }

  const targetOwner = target ? game.players.find((p) => p.rack.some((w) => w.id === target)) : undefined;
  const targetNumber = targetOwner ? targetOwner.rack.findIndex((w) => w.id === target) + 1 : 0;
  const canConfirm = myTurn && !busy && target !== null && guess !== null && !needOwn;

  const confirmCut = () => {
    if (!canConfirm) return;
    const action: ClientAction = { type: 'dualCut', targetWireId: target!, guess: guess! };
    if (ownWire) action.ownWireId = ownWire;
    void send(action);
  };

  const confirmLabel =
    targetOwner && guess !== null
      ? t('confirmCut', { name: nameOf(room, targetOwner.id), n: targetNumber, v: guessText(t, guess) })
      : target
        ? t('pickValue')
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
            <div className="banner" role="status">
              <strong>{t('revealTitle')}</strong>
              <span>
                {me.revealDone
                  ? t('revealWaiting', {
                      done: game.players.filter((p) => p.revealDone).length,
                      total: game.players.length,
                    })
                  : t('revealHint')}
              </span>
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
              onPick={(id) => setTarget(id)}
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
                  const ownPick = myTurn && candidates.length > 1 && candidates.includes(w);
                  return (
                    <Wire
                      key={w.id}
                      wire={w}
                      number={i + 1}
                      size="lg"
                      label={t('yourWireLabel', { n: i + 1 })}
                      pickable={revealPick || ownPick}
                      selected={ownWire === w.id}
                      onPick={
                        revealPick
                          ? () => void send({ type: 'reveal', wireId: w.id })
                          : ownPick
                            ? () => setOwnWire(w.id)
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
                  <>
                    <div className="action-col grow">
                      <span className="muted small">{t('dualHint')}</span>
                      <div className="guesses">
                        {sortGuesses(game.legal.dualCut).map((g) => (
                          <button
                            key={String(g)}
                            type="button"
                            className={g === 'yellow' ? 'guess guess-yellow' : 'guess'}
                            aria-pressed={guess === g}
                            onClick={() => {
                              setGuess(g);
                              setOwnWire(null);
                            }}
                          >
                            {guessText(t, g)}
                          </button>
                        ))}
                      </div>
                      <div className="confirm-row">
                        <button type="button" className="btn light" disabled={!canConfirm} onClick={confirmCut}>
                          <ScissorsIcon />
                          {needOwn && guess !== null ? t('pickOwn', { v: guessText(t, guess) }) : confirmLabel}
                        </button>
                        <span className="muted small">{t('warning')}</span>
                      </div>
                    </div>
                    <div className="action-col solo">
                      <span className="muted small">{t('soloHint')}</span>
                      {game.legal.soloCut.length === 0 && <span className="dim small">{t('soloNone')}</span>}
                      {sortGuesses(game.legal.soloCut).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          className="btn outline"
                          disabled={busy}
                          onClick={() => void send({ type: 'soloCut', value: v })}
                        >
                          {v === 'yellow' ? t('soloCutYellow') : t('soloCut', { v })}
                        </button>
                      ))}
                      {game.legal.soloCut.length > 0 && <span className="dim small">{t('soloSafe')}</span>}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="table-side">
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
