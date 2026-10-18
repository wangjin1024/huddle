import { useEffect, useState } from 'react';
import {
  COLOURS,
  COPIES,
  MAX_HINTS,
  MAX_MISPLAYS,
  NUMBERS,
  hintOptions,
  touches,
  type CardView,
  type Face,
  type GameView,
  type HintValue,
} from '@hanabi/engine';
import type { ClientAction, RoomView } from '@hanabi/server/protocol';
import { useI18n } from '../i18n';
import { api } from '../net';
import { cardName, colourName, hintText, knowledgeText, logText, logTone, nameOf, turnLabel } from '../format';
import { CardBack, CardFace, KnowledgeStrip } from './Cards';
import { Header } from './Header';
import { ColourSymbol, SparkIcon } from './Icons';
import { Result } from './Result';

interface GameProps {
  room: RoomView;
  onError: (code: string) => void;
  onLeave: () => void;
}

/** A hint being composed: for one teammate, started from one of their cards or from their name. */
interface Composer {
  to: string;
  cardId: string | null;
}

const faceOf = (c: CardView): Face | null => (c.colour && c.number ? { colour: c.colour, number: c.number } : null);

export function Game({ room, onError, onLeave }: GameProps) {
  const { t } = useI18n();
  const game = room.game!;
  const over = game.phase === 'over';
  const seat = game.players.findIndex((p) => p.id === room.you);
  const me = game.players[seat];
  // Teammates in turn order from you, so the next player is first.
  const teammates = [...game.players.slice(seat + 1), ...game.players.slice(0, Math.max(seat, 0))];
  const current = room.players.find((p) => p.id === game.currentPlayer);
  const currentSeat = game.players.findIndex((p) => p.id === game.currentPlayer);
  const nextId = game.players[(currentSeat + 1) % game.players.length]!.id;
  const myTurn = game.legal.play;

  const [composer, setComposer] = useState<Composer | null>(null);
  const [choice, setChoice] = useState<HintValue | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(true);

  // Every new turn invalidates a half-made hint or selection.
  useEffect(() => {
    setComposer(null);
    setChoice(null);
    setSelected(null);
  }, [room.log.length, game.phase]);
  useEffect(() => setShowResult(true), [game.phase]);

  async function send(action: ClientAction) {
    setBusy(true);
    const r = await api.act(action);
    setBusy(false);
    if (!r.ok) onError(r.error);
  }

  // The latest turn's hint pulses on the cards it named.
  const lastTurn = room.log.at(-1)?.turn;
  const flash = new Set(room.log.filter((e) => e.turn === lastTurn).flatMap((e) => (e.event.type === 'hinted' ? e.event.cardIds : [])));
  const isNew = (c: CardView) => !over && c.drawnAt >= 0 && game.turn - c.drawnAt <= game.players.length;

  function openComposer(to: string, cardId: string | null) {
    if (!myTurn) return;
    setSelected(null);
    setComposer({ to, cardId });
    setChoice(null);
  }

  let banner: { text: string; warn?: boolean } | null = null;
  if (!over && current && !current.connected) banner = { text: t('paused', { name: current.name }), warn: true };

  return (
    <div className="app">
      <Header>
        <div className="room-meta">
          <span className="muted small">{t('room')}</span>
          <span className="code mono">{room.code}</span>
          <span className="chip">{t('playersChip', { n: game.players.length, h: me?.hand.length ?? 0 })}</span>
        </div>
      </Header>

      <div className="table">
        <StatusBar game={game} room={room} />
        {banner && (
          <div className={banner.warn ? 'banner warn' : 'banner'} role="status">
            {banner.text}
          </div>
        )}

        <div className="table-cols">
          <main className="table-main">
            <Fireworks game={game} />

            {teammates.map((p) => {
              const name = nameOf(room, p.id);
              const isCurrent = !over && p.id === game.currentPlayer;
              const open = composer?.to === p.id;
              const faces = p.hand.map(faceOf).filter((f): f is Face => f !== null);
              const named = open && choice ? new Set(touches(p.hand as (CardView & Face)[], choice).map((c) => c.id)) : null;
              return (
                <section key={p.id} className={['mate', isCurrent ? 'current' : '', open ? 'composing' : ''].join(' ')}>
                  <div className="mate-row">
                    <div className="mate-head">
                      <span className="rack-name">{name}</span>
                      <span className="muted small">
                        {isCurrent ? t('turnNow') : p.id === nextId && !over ? t('next') : t('nCards', { n: p.hand.length })}
                      </span>
                      {myTurn && game.legal.hint && (
                        <button type="button" className="btn small-btn" onClick={() => openComposer(p.id, null)}>
                          {t('hintFor', { name })}
                        </button>
                      )}
                    </div>
                    <div className="mate-hand">
                      {p.hand.map((c) => {
                        const f = faceOf(c);
                        if (!f) return null;
                        const k = knowledgeText(t, c.knowledge);
                        return (
                          <div key={c.id} className="mate-card">
                            <CardFace
                              colour={f.colour}
                              number={f.number}
                              label={`${cardName(t, f)}. ${t('knowsAria', { name, k })}`}
                              ring={named?.has(c.id) ? 'touch' : flash.has(c.id) ? 'flash' : undefined}
                              isNew={isNew(c)}
                              onClick={myTurn && game.legal.hint ? () => openComposer(p.id, c.id) : undefined}
                            />
                            <KnowledgeStrip card={c} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {open && (
                    <HintComposer
                      name={name}
                      hand={p.hand}
                      faces={faces}
                      cardId={composer.cardId}
                      choice={choice}
                      hints={game.hints}
                      busy={busy}
                      onChoose={setChoice}
                      onCancel={() => setComposer(null)}
                      onSend={(h) => send({ type: 'hint', to: p.id, ...h } as ClientAction)}
                    />
                  )}
                </section>
              );
            })}

            {me && (
              <section className={myTurn ? 'my-panel active' : 'my-panel'}>
                <div className="rack-head">
                  <span className="rack-name">{t('yourHand')}</span>
                  <span className="muted small">{myTurn ? t('tapToAct') : t('yourHandNote')}</span>
                </div>
                <div className="my-hand">
                  {me.hand.map((c, i) =>
                    over && c.colour && c.number ? (
                      <div key={c.id} className="mate-card">
                        <CardFace colour={c.colour} number={c.number} size="md" label={cardName(t, { colour: c.colour, number: c.number })} />
                        <span className="muted small">{t('cardN', { n: i + 1 })}</span>
                      </div>
                    ) : (
                      <div key={c.id} className="mate-card">
                        <CardBack
                          card={c}
                          label={t('yourCardAria', { n: i + 1, k: knowledgeText(t, c.knowledge) })}
                          selected={selected === c.id}
                          ring={flash.has(c.id) ? 'flash' : undefined}
                          isNew={isNew(c)}
                          disabled={!myTurn || busy}
                          onClick={() => {
                            setComposer(null);
                            setSelected(selected === c.id ? null : c.id);
                          }}
                        />
                        <span className="muted small">{t('cardN', { n: i + 1 })}</span>
                      </div>
                    ),
                  )}
                </div>
                {myTurn && selected && (
                  <MyCardActions
                    game={game}
                    card={me.hand.find((c) => c.id === selected)!}
                    slot={me.hand.findIndex((c) => c.id === selected) + 1}
                    busy={busy}
                    onPlay={() => send({ type: 'play', cardId: selected })}
                    onDiscard={() => send({ type: 'discard', cardId: selected })}
                  />
                )}
              </section>
            )}
          </main>

          <aside className="table-side">
            <DiscardGrid game={game} />
            <Log room={room} />
          </aside>
        </div>
      </div>

      {over &&
        (showResult ? (
          <Result
            room={room}
            onPlayAgain={async () => {
              const r = await api.playAgain();
              if (!r.ok) onError(r.error);
            }}
            onBack={() => setShowResult(false)}
            onLeave={onLeave}
          />
        ) : (
          <button type="button" className="btn primary result-fab" onClick={() => setShowResult(true)}>
            {t('showResult')}
          </button>
        ))}
    </div>
  );
}

function StatusBar({ game, room }: { game: GameView; room: RoomView }) {
  const { t } = useI18n();
  const over = game.phase === 'over';
  const myTurn = game.legal.play;
  return (
    <div className="status">
      <div className="stat-group">
        <span className="stat-label">
          {t('hintsLabel')} · <span className="mono strong">{game.hints}</span> / {MAX_HINTS}
        </span>
        <span className="tokens" role="img" aria-label={t('hintsAria', { n: game.hints })}>
          {Array.from({ length: MAX_HINTS }, (_, i) => (
            <span key={i} className={i < game.hints ? 'token on' : 'token'} />
          ))}
        </span>
      </div>
      <div className="stat-group">
        <span className="stat-label">
          {t('misplaysLabel')} · <span className="mono bad">{game.misplays}</span> / {MAX_MISPLAYS}
        </span>
        <span className="tokens" role="img" aria-label={t('misplaysAria', { n: game.misplays })}>
          {Array.from({ length: MAX_MISPLAYS }, (_, i) => (
            <SparkIcon key={i} lit={i < game.misplays} />
          ))}
        </span>
      </div>
      <div className="stat-group">
        <span className="stat-label">{t('deckLabel')}</span>
        <span className="mono stat-num">{game.deckCount}</span>
      </div>
      <div className="stat-group">
        <span className="stat-label">{t('scoreLabel')}</span>
        <span className="mono stat-num">
          {game.score} <span className="muted small">/ 25 · {t('bestLabel', { n: game.maxScore })}</span>
        </span>
      </div>
      <div className="spacer" />
      {!over && game.turnsLeft !== null && (
        <span className="pill warn">{game.turnsLeft === 1 ? t('finalRoundOne') : t('finalRound', { n: game.turnsLeft })}</span>
      )}
      {!over && (
        <span className={myTurn ? 'turn-pill mine' : 'turn-pill'}>
          <span className="turn-dot" />
          <strong>{myTurn ? t('yourTurn') : t('theirTurn', { name: nameOf(room, game.currentPlayer) })}</strong>
          {myTurn && <span className="muted small">{t('yourTurnSub')}</span>}
        </span>
      )}
    </div>
  );
}

function Fireworks({ game }: { game: GameView }) {
  const { t } = useI18n();
  return (
    <section className="fireworks">
      <h2 className="section-label">{t('fireworks')}</h2>
      <div className="fw-grid">
        {COLOURS.map((c) => {
          const top = game.fireworks[c];
          const label = t('fireworkAria', { colour: colourName(t, c), n: top });
          return (
            <div key={c} className="fw">
              {top > 0 ? (
                <CardFace colour={c} number={top as 1} size="lg" label={label} />
              ) : (
                <div className={`hcard hcard-lg empty edge-${c}`} role="img" aria-label={label}>
                  <span className="hcard-sym">
                    <ColourSymbol colour={c} size={26} tinted />
                  </span>
                </div>
              )}
              <span className="pips" aria-hidden="true">
                {NUMBERS.map((n) => (
                  <span key={n} className={n <= top ? `pip fill-bg-${c}` : 'pip'} />
                ))}
              </span>
              <span className="muted small">{colourName(t, c)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface ComposerProps {
  name: string;
  hand: CardView[];
  faces: Face[];
  cardId: string | null;
  choice: HintValue | null;
  hints: number;
  busy: boolean;
  onChoose: (h: HintValue) => void;
  onCancel: () => void;
  onSend: (h: HintValue) => void;
}

function HintComposer({ name, hand, faces, cardId, choice, hints, busy, onChoose, onCancel, onSend }: ComposerProps) {
  const { t } = useI18n();
  const slot = cardId ? hand.findIndex((c) => c.id === cardId) : -1;
  const card = slot >= 0 ? faceOf(hand[slot]!) : null;
  const options: HintValue[] = card ? [{ colour: card.colour }, { number: card.number }] : hintOptions(faces);
  const named = choice ? hand.flatMap((c, i) => (faceOf(c) && touches([faceOf(c)!], choice).length ? [i + 1] : [])) : [];
  const same = (a: HintValue, b: HintValue | null) => !!b && a.colour === b.colour && a.number === b.number;

  return (
    <div className="composer" role="group" aria-label={t('composerTitle', { name })}>
      <div className="composer-head">
        <strong>{t('composerTitle', { name })}</strong>
        <span className="muted small">{hints > 0 ? t('usesToken', { n: hints }) : t('noHints')}</span>
      </div>
      <p className="muted small">{card ? t('composerCard', { n: slot + 1 }) : t('composerAll')}</p>
      <div className="hint-options">
        {options.map((h) => (
          <button
            key={h.colour ?? h.number}
            type="button"
            className={h.colour ? `hint-opt opt-${h.colour}` : 'hint-opt opt-num'}
            aria-pressed={same(h, choice)}
            onClick={() => onChoose(h)}
          >
            {h.colour ? (
              <>
                <ColourSymbol colour={h.colour} size={16} tinted />
                {colourName(t, h.colour)}
              </>
            ) : (
              <span className="mono">{h.number}</span>
            )}
          </button>
        ))}
      </div>
      {choice && (
        <p className="composer-note">
          {t(named.length === 1 ? 'touchesOne' : 'touchesMany', { list: named.join(', ') })}{' '}
          {named.length < hand.length && t('alsoNot', { name, v: hintText(t, choice).toLowerCase() })}
        </p>
      )}
      <div className="composer-actions">
        <button type="button" className="btn outline" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button type="button" className="btn primary" disabled={!choice || busy || hints === 0} onClick={() => choice && onSend(choice)}>
          {choice
            ? named.length === 1
              ? t('tellCtaOne', { name, v: hintText(t, choice) })
              : t('tellCta', { name, v: hintText(t, choice), n: named.length })
            : t('composerTitle', { name })}
        </button>
      </div>
    </div>
  );
}

interface MyCardActionsProps {
  game: GameView;
  card: CardView;
  slot: number;
  busy: boolean;
  onPlay: () => void;
  onDiscard: () => void;
}

function MyCardActions({ game, card, slot, busy, onPlay, onDiscard }: MyCardActionsProps) {
  const { t } = useI18n();
  const k = card.knowledge;
  const known = k.colour || k.number || k.notColours.length || k.notNumbers.length;
  return (
    <div className="actions">
      <p className="selected-note">
        {known ? t('selectedSays', { n: slot, k: knowledgeText(t, k) }) : t('hintsSaidNothing', { n: slot })}
      </p>
      <div className="action-buttons">
        <button type="button" className="btn outline" disabled={busy || !game.legal.discard} onClick={onDiscard}>
          {t('discardCta')} <span className="muted small">{t('discardPlus')}</span>
        </button>
        <button type="button" className="btn primary" disabled={busy} onClick={onPlay}>
          {t('playCta', { n: slot })}
        </button>
      </div>
      {!game.legal.discard && <p className="muted small">{t('hintsFull')}</p>}
    </div>
  );
}

function DiscardGrid({ game }: { game: GameView }) {
  const { t } = useI18n();
  return (
    <section className="card">
      <div className="row-between">
        <h2>{t('discards')}</h2>
        <span className="muted small">{t('copiesLeft')}</span>
      </div>
      <div className="dgrid">
        <span />
        {NUMBERS.map((n) => (
          <span key={n} className="dgrid-head mono">
            {n}
          </span>
        ))}
        {COLOURS.map((c) => [
          <span key={c} className="dgrid-row">
            <ColourSymbol colour={c} size={14} tinted />
          </span>,
          ...NUMBERS.map((n) => {
            const gone = game.discard.filter((f) => f.colour === c && f.number === n).length;
            const left = COPIES[n] - gone;
            const played = n <= game.fireworks[c];
            const cls = played ? 'played' : left === 0 ? 'gone' : left === 1 ? 'last' : '';
            const card = cardName(t, { colour: c, number: n });
            return (
              <span key={`${c}${n}`} className={`dcell mono ${cls}`} title={t('cellAria', { card, left, total: COPIES[n] })}>
                <span className="sr-only">{t('cellAria', { card, left, total: COPIES[n] })}</span>
                <span aria-hidden="true">
                  {left}/{COPIES[n]}
                </span>
              </span>
            );
          }),
        ])}
      </div>
      <div className="legend-row">
        <span>
          <span className="swatch last" /> {t('legendLast')}
        </span>
        <span>
          <span className="swatch gone" /> {t('legendGone')}
        </span>
        <span>
          <span className="swatch played" /> {t('legendPlayed')}
        </span>
      </div>
    </section>
  );
}

function Log({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const entries = [...room.log].reverse();
  return (
    <section className="card log">
      <h2>{t('log')}</h2>
      {entries.length === 0 ? (
        <p className="muted small">{t('logEmpty')}</p>
      ) : (
        <ol>
          {entries.map((e) => (
            <li key={e.seq}>
              <span className={`log-dot tone-${logTone(e)}`} />
              <span className="mono dim log-turn">{turnLabel(t, e.turn)}</span>
              <span>{logText(t, room, e)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
