import { useEffect, useState } from 'react';
import {
  ENEMY_RANKS,
  SUITS,
  cardValue,
  isImmune,
  previewPlay,
  rankOf,
  suitOf,
  totalValue,
  type Card,
  type GameView,
  type PlayPreview,
} from '@regicide/engine';
import type { ClientAction, RoomView } from '@regicide/server/protocol';
import { errorText, useI18n } from '../i18n';
import { api } from '../net';
import { GLYPH, cardText, cardsText, enemyName, logText, logTone, nameOf } from '../format';
import { CardChip, PlayingCard } from './Card';
import { Header } from './Header';
import { JesterIcon } from './Icons';
import { Result } from './Result';

interface GameProps {
  room: RoomView;
  onError: (code: string) => void;
  onLeave: () => void;
}

type Mode = 'play' | 'discard' | 'choose' | null;

export function Game({ room, onError, onLeave }: GameProps) {
  const { t } = useI18n();
  const game = room.game!;
  const seat = game.players.findIndex((p) => p.id === room.you);
  // Teammates clockwise from you, so the next player is first.
  const teammates = [...game.players.slice(seat + 1), ...game.players.slice(0, seat)];
  const over = game.phase === 'won' || game.phase === 'lost';
  const currentSeat = game.players.findIndex((p) => p.id === game.currentPlayer);
  const nextId = game.players[(currentSeat + 1) % game.players.length]!.id;
  const current = room.players.find((p) => p.id === game.currentPlayer);
  const mode: Mode = game.legal.play ? 'play' : game.legal.discard !== null ? 'discard' : game.legal.chooseNext ? 'choose' : null;
  const enemy = enemyName(t, game.enemy.card);

  const [picked, setPicked] = useState<Card[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(true);

  // Every new event invalidates a half-made selection.
  useEffect(() => {
    setPicked([]);
    setNext(null);
  }, [room.log.length, game.phase]);
  useEffect(() => setShowResult(true), [game.phase]);

  async function send(action: ClientAction) {
    setBusy(true);
    const r = await api.act(action);
    setBusy(false);
    if (!r.ok) onError(r.error);
  }

  // In hand order, so "7♣ + A♥" reads the same however the cards were tapped.
  const cards = game.hand.filter((c) => picked.includes(c));
  const toggle = (c: Card) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const preview = mode === 'play' && cards.length > 0 ? previewPlay(game.enemy, cards) : null;
  const previewDamage = preview?.ok ? Math.min(preview.preview.damage, game.enemy.hp) : 0;

  let banner: { text: string; warn?: boolean } | null = null;
  if (!over) {
    if (mode === 'play') banner = { text: t('bannerPlay') };
    else if (mode === 'discard') banner = { text: t('bannerDiscard', { enemy, n: game.enemy.attack }), warn: true };
    else if (mode === 'choose') banner = { text: t('bannerChoose') };
    else if (current && !current.connected) banner = { text: t('paused', { name: current.name }), warn: true };
    else if (current && game.phase === 'discard') banner = { text: t('waitDiscard', { name: current.name, n: game.enemy.attack }) };
    else if (current && game.phase === 'chooseNext') banner = { text: t('waitChoose', { name: current.name }) };
    else if (current) banner = { text: t('waitingFor', { name: current.name }) };
  }

  const myName = nameOf(room, room.you);
  const myChip = mode === 'play' ? t('yourTurn') : mode === 'discard' ? t('takeDamage') : mode === 'choose' ? t('choosing') : null;

  return (
    <div className="app">
      <Header>
        <div className="room-meta">
          <span className="muted small">{t('room')}</span>
          <span className="code mono">{room.code}</span>
          <span className="chip">
            {game.players.length === 1
              ? t('soloChip', { h: game.handSize })
              : t('playersChip', { n: game.players.length, h: game.handSize })}
          </span>
        </div>
      </Header>

      <div className="table">
        <main className="table-main">
          {banner && (
            <div className={banner.warn ? 'banner warn' : 'banner'} role="status">
              {banner.text}
            </div>
          )}

          <EnemyPanel game={game} previewDamage={previewDamage} />
          <CastleTrack game={game} />

          {teammates.length > 0 && (
            <div className="mates">
              {teammates.map((p) => {
                const rp = room.players.find((x) => x.id === p.id);
                const isCurrent = p.id === game.currentPlayer && !over;
                return (
                  <section key={p.id} className={isCurrent ? 'mate current' : 'mate'}>
                    <div className="mate-head">
                      <span className="avatar">{nameOf(room, p.id)[0]}</span>
                      <span className="rack-name grow">{nameOf(room, p.id)}</span>
                      <span className="mono small">{t('cardsOf', { n: p.handCount, max: game.handSize })}</span>
                    </div>
                    <div
                      className="backs"
                      role="img"
                      aria-label={t('cardsLabel', { name: nameOf(room, p.id), n: p.handCount, max: game.handSize })}
                    >
                      {Array.from({ length: game.handSize }, (_, i) => (
                        <span key={i} className={i < p.handCount ? 'back' : 'back empty'} />
                      ))}
                    </div>
                    <div className="mate-tags">
                      {isCurrent && <span className="pill">{t('turnNow')}</span>}
                      {!isCurrent && p.id === nextId && !over && <span className="pill">{t('nextTurn')}</span>}
                      {rp && !rp.connected && <span className="pill warn">{t('reconnecting')}</span>}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <section className={mode === 'discard' ? 'my-panel hurt' : mode ? 'my-panel active' : 'my-panel'} aria-label={myName}>
            <div className="rack-head">
              <span className="avatar me">{myName[0]}</span>
              <span className="rack-name">
                {myName} {t('you')}
              </span>
              {myChip && <span className={mode === 'discard' ? 'turn-chip hurt' : 'turn-chip'}>{myChip}</span>}
              <span className="muted small">
                {t('handCount', { n: game.hand.length, max: game.handSize })} · {t('handTotal', { n: totalValue(game.hand) })}
              </span>
            </div>
            <div className="hand">
              {game.hand.map((c) => (
                <PlayingCard
                  key={c}
                  card={c}
                  picked={picked.includes(c) ? (mode === 'discard' ? 'discard' : 'play') : undefined}
                  onClick={(mode === 'play' || mode === 'discard') && !busy ? () => toggle(c) : undefined}
                />
              ))}
            </div>

            {mode === 'play' && (
              <div className="actions">
                <div className="action-col grow">
                  {!preview ? (
                    <span className="muted">{t('playIdle')}</span>
                  ) : !preview.ok ? (
                    <p className="error" role="alert">
                      {errorText(t, preview.error)}
                    </p>
                  ) : (
                    <PreviewView game={game} cards={cards} preview={preview.preview} />
                  )}
                </div>
                <div className="action-col side">
                  <button
                    type="button"
                    className="btn primary big"
                    disabled={!preview?.ok || busy}
                    onClick={() => void send({ type: 'play', cards })}
                  >
                    {preview?.ok ? t('playCta', { cards: cardsText(t, cards) }) : t('play')}
                  </button>
                  <span className="muted small">{t('powerOrder')}</span>
                </div>
              </div>
            )}

            {mode === 'discard' && (
              <DiscardBar
                attack={game.legal.discard!}
                cards={cards}
                busy={busy}
                onDiscard={() => void send({ type: 'discard', cards })}
              />
            )}

            {mode === 'choose' && (
              <div className="actions">
                <div className="action-col grow">
                  <h2>{t('chooseTitle')}</h2>
                  <div className="seat-pick" role="radiogroup" aria-label={t('chooseTitle')}>
                    {game.players.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={next === p.id}
                        className="seat-option"
                        onClick={() => setNext(p.id)}
                      >
                        <span className={p.id === room.you ? 'avatar me' : 'avatar'}>{nameOf(room, p.id)[0]}</span>
                        <span className="grow">
                          <strong>
                            {nameOf(room, p.id)} {p.id === room.you ? t('you') : ''}
                          </strong>
                          <span className="muted small"> · {t('handCount', { n: p.handCount, max: game.handSize })}</span>
                        </span>
                        <span className="radio-dot" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="action-col side">
                  <button
                    type="button"
                    className="btn primary big"
                    disabled={!next || busy}
                    onClick={() => void send({ type: 'chooseNext', next: next! })}
                  >
                    {next ? t('chooseCta', { name: nameOf(room, next) }) : t('chooseIdle')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>

        <aside className="table-side">
          <TableCard game={game} />
          <section className="card">
            <h2>{t('suitPowers')}</h2>
            <ul className="legend">
              {SUITS.map((s) => {
                const blocked = isImmune(game.enemy, s);
                return (
                  <li key={s} className={blocked ? 'blocked' : undefined}>
                    <span className={`suit-box ${s === 'H' || s === 'D' ? 'pcard-red' : 'pcard-black'}`}>
                      <span className="suit">{GLYPH[s]}</span>
                    </span>
                    <span>
                      <strong className="strong">{t(`power.${s}`)}.</strong> {t(`legend.${s}`)}{' '}
                      {blocked && <strong className="blocked-tag">{t('blockedNow')}</strong>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
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
          onBack={() => setShowResult(false)}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}

function EnemyPanel({ game, previewDamage }: { game: GameView; previewDamage: number }) {
  const { t } = useI18n();
  const e = game.enemy;
  const suit = suitOf(e.card)!;
  const after = e.hp - previewDamage;
  return (
    <section className="enemy-panel" aria-label={enemyName(t, e.card)}>
      <PlayingCard card={e.card} size="lg" />
      <div className="enemy-info">
        <div className="enemy-title">
          <h1>{enemyName(t, e.card)}</h1>
          <span className="muted small">{t('enemyOf', { n: Math.min(game.defeated.length + 1, 12) })}</span>
        </div>

        <div className="hp">
          <div className="row-between small">
            <span className="muted">{t('health')}</span>
            <span>
              <strong className="mono hp-num">{previewDamage ? `${e.hp} → ${Math.max(after, 0)}` : e.hp}</strong>{' '}
              <span className="muted">/ {e.maxHp}</span>
            </span>
          </div>
          <div className="hp-bar" role="img" aria-label={`${t('health')} ${e.hp} / ${e.maxHp}`}>
            <span className="hp-fill" style={{ width: `${(Math.max(after, 0) / e.maxHp) * 100}%` }} />
            <span className="hp-dmg" style={{ width: `${(previewDamage / e.maxHp) * 100}%` }} />
          </div>
        </div>

        <div className="enemy-stats">
          <div className="stat-box">
            <span className="muted small">{t('attack')}</span>
            {e.shield > 0 && (
              <span className="mono small attack-calc">
                {e.baseAttack} <span className="shield">{t('shieldMinus', { n: e.shield })}</span> =
              </span>
            )}
            <strong className="mono attack-num">{e.attack}</strong>
          </div>
          {e.immunityCancelled ? (
            <div className="stat-box cancelled">
              <span className="small">{t('immuneCancelled')}</span>
              <span className="small muted">{t('immuneCancelledNote')}</span>
            </div>
          ) : (
            <div className="stat-box immune">
              <span className="small">{t('immuneTitle')}</span>
              <strong className="immune-text">
                {t('immuneText', { glyph: GLYPH[suit], power: t(`power.${suit}`) })}
              </strong>
              <span className="small immune-note">{t('immuneNote')}</span>
            </div>
          )}
        </div>

        <div className="played-row">
          <span className="muted small">{t('playedAgainst')}</span>
          {game.played.length === 0 ? (
            <span className="dim small">{t('nothingYet')}</span>
          ) : (
            game.played.map((c) => <CardChip key={c} card={c} />)
          )}
        </div>
      </div>
    </section>
  );
}

function CastleTrack({ game }: { game: GameView }) {
  const { t } = useI18n();
  const exact = game.defeated.filter((d) => d.exact).length;
  const live = game.phase !== 'won';
  return (
    <section className="card castle" aria-label={t('castle')}>
      <div className="row-between">
        <h2>{t('castle')}</h2>
        <span className="muted small">{t('castleSummary', { d: game.defeated.length, e: exact })}</span>
      </div>
      <div className="castle-groups">
        {ENEMY_RANKS.map((rank) => (
          <div key={rank} className="castle-group">
            <span className="dim small">{t(`group.${rank}`)}</span>
            <div className="castle-slots">
              {game.defeated
                .filter((d) => rankOf(d.card) === rank)
                .map((d) => (
                  <span key={d.card} className={d.exact ? 'slot exact' : 'slot over'} title={cardText(t, d.card)}>
                    <span className="mono">{rank}</span>
                    <span className="suit">{GLYPH[suitOf(d.card)!]}</span>
                  </span>
                ))}
              {live && rankOf(game.enemy.card) === rank && (
                <span className={`slot current ${suitOf(game.enemy.card) === 'H' || suitOf(game.enemy.card) === 'D' ? 'pcard-red' : 'pcard-black'}`}>
                  <span className="mono">{rank}</span>
                  <span className="suit">{GLYPH[suitOf(game.enemy.card)!]}</span>
                </span>
              )}
              {Array.from({ length: game.castleLeft[rank] }, (_, i) => (
                <span key={i} className="slot hidden" title={t('hiddenEnemy')}>
                  <span className="mono">{rank}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="castle-legend small muted">
        <span>
          <span className="dot dot-gold" /> {t('legendExact')}
        </span>
        <span>
          <span className="dot dot-cut" /> {t('legendOver')}
        </span>
      </div>
    </section>
  );
}

function PreviewView({ game, cards, preview: p }: { game: GameView; cards: Card[]; preview: PlayPreview }) {
  const { t } = useI18n();
  const enemy = enemyName(t, game.enemy.card);
  let outcome: string;
  if (p.outcome === 'exact') outcome = t('out.exact', { enemy, v: cardValue(game.enemy.card) });
  else if (p.outcome === 'overkill') outcome = t('out.overkill', { enemy, n: -p.hpAfter });
  else if (p.outcome === 'jester') outcome = t('out.jester');
  else if (p.attackAfter > 0) outcome = t('out.survives', { enemy, hp: p.hpAfter, attack: p.attackAfter });
  else outcome = t('out.noAttack', { enemy, hp: p.hpAfter });

  return (
    <>
      <div className="preview-head">
        <strong>{cardsText(t, cards)}</strong>
        <span className="pill">{t(`kind.${p.kind}`)}</span>
        <span className="muted small">{p.kind === 'jester' ? t('noDamage') : t('baseValue', { n: p.base })}</span>
      </div>
      <ul className="effects">
        {p.kind === 'jester' ? (
          <>
            <li>
              <span className="suit-box pcard-jester">
                <JesterIcon size={18} />
              </span>
              <span>
                <strong>{t('jesterImmunity')}</strong> · {t('jesterImmunityText', { enemy })}
              </span>
            </li>
            <li>
              <span className="suit-box pcard-jester">
                <JesterIcon size={18} />
              </span>
              <span>
                <strong>{t('jesterNoAttack')}</strong> · {t('jesterNoAttackText')}
              </span>
            </li>
          </>
        ) : (
          p.powers.map((pw) => {
            let text: string;
            if (pw.immune) text = t('powerImmune', { enemy });
            else if (pw.suit === 'H') text = t('powerText.H', { n: pw.amount });
            else if (pw.suit === 'D') text = t('powerText.D', { n: pw.amount, max: game.handSize });
            else if (pw.suit === 'S') text = t('powerText.S', { from: game.enemy.attack, to: p.attackAfter });
            else text = t('powerText.C', { n: p.base, d: p.damage });
            return (
              <li key={pw.suit} className={pw.immune ? 'immune' : undefined}>
                <span className={`suit-box ${pw.suit === 'H' || pw.suit === 'D' ? 'pcard-red' : 'pcard-black'}`}>
                  <span className="suit">{GLYPH[pw.suit]}</span>
                </span>
                <span>
                  <strong>{t(`power.${pw.suit}`)}</strong> · {text}
                </span>
              </li>
            );
          })
        )}
      </ul>
      <div className={`outcome outcome-${p.outcome}`}>
        <strong className="mono">{t('damageShort', { n: p.damage })}</strong>
        <span>{outcome}</span>
      </div>
    </>
  );
}

function DiscardBar({ attack, cards, busy, onDiscard }: { attack: number; cards: Card[]; busy: boolean; onDiscard: () => void }) {
  const { t } = useI18n();
  const total = totalValue(cards);
  const covered = total >= attack;
  return (
    <div className="actions">
      <div className="action-col grow">
        <div className="row-between">
          <span>{t('discardProgress', { n: total, attack })}</span>
          {covered && <strong className="ok">{t('covered')}</strong>}
        </div>
        <div className="progress" role="img" aria-label={t('discardProgress', { n: total, attack })}>
          <span style={{ width: `${Math.min(100, (total / attack) * 100)}%` }} />
        </div>
        <span className="muted small">{t('discardNote')}</span>
      </div>
      <div className="action-col side">
        <button type="button" className="btn primary big" disabled={!covered || busy} onClick={onDiscard}>
          {cards.length ? t('discardCta', { cards: cardsText(t, cards) }) : t('discard')}
        </button>
      </div>
    </div>
  );
}

function TableCard({ game }: { game: GameView }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const top = game.discard.at(-1);
  return (
    <section className="card">
      <h2>{t('table')}</h2>
      <div className="table-counts">
        <div className="count-box">
          <span className="deck-back" aria-hidden="true" />
          <span className="count-text">
            <strong className="mono">{game.tavernCount}</strong>
            <span className="muted small">{t('tavern')}</span>
          </span>
        </div>
        <button type="button" className="count-box" aria-expanded={open} onClick={() => setOpen(!open)}>
          {top ? <CardChip card={top} /> : <span className="deck-back empty" aria-hidden="true" />}
          <span className="count-text">
            <strong className="mono">{game.discard.length}</strong>
            <span className="muted small underline">
              {t('discardPile')} · {open ? t('hide') : t('view')}
            </span>
          </span>
        </button>
      </div>
      {game.tavernTop && <p className="muted small table-note">{t('tavernTop', { card: cardText(t, game.tavernTop) })}</p>}
      {open &&
        (game.discard.length === 0 ? (
          <p className="muted small table-note">{t('discardEmpty')}</p>
        ) : (
          <div className="chip-list">
            {game.discard.map((c) => (
              <CardChip key={c} card={c} />
            ))}
          </div>
        ))}
    </section>
  );
}
