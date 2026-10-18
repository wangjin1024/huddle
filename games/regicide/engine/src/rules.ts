import { ENEMY, SUITS, isCard, isEnemyRank, isJester, rankOf, suitOf, totalValue } from './cards.js';
import type { Card, Enemy, EnemyRank, PlayError, Suit } from './types.js';

export type PlayKind = 'single' | 'ace' | 'set' | 'jester';

/**
 * What kind of play `cards` is, or why it isn't one:
 * - one card;
 * - an Ace with exactly one other card (another Ace, a number or an enemy card);
 * - 2–4 number cards (2–10) of one rank totalling 10 or less;
 * - a Jester, alone.
 */
export function playKind(cards: Card[]): { ok: true; kind: PlayKind } | { ok: false; error: PlayError } {
  if (cards.length === 0) return { ok: false, error: 'NO_CARDS' };
  if (!cards.every(isCard) || new Set(cards).size !== cards.length) return { ok: false, error: 'INVALID_CARDS' };
  if (cards.some(isJester)) return cards.length === 1 ? { ok: true, kind: 'jester' } : { ok: false, error: 'JESTER_ALONE' };
  if (cards.length === 1) return { ok: true, kind: 'single' };
  const ranks = cards.map(rankOf);
  const aces = ranks.filter((r) => r === 'A').length;
  if (aces > 0) return cards.length === 2 ? { ok: true, kind: 'ace' } : { ok: false, error: 'ACE_PAIR_ONLY' };
  if (ranks.some((r) => r !== ranks[0])) return { ok: false, error: 'MIXED_RANKS' };
  if (isEnemyRank(ranks[0]!) || totalValue(cards) > 10) return { ok: false, error: 'SET_TOO_HIGH' };
  return { ok: true, kind: 'set' };
}

const enemyRank = (e: Pick<Enemy, 'card'>) => rankOf(e.card) as EnemyRank;

export const enemyMaxHp = (e: Pick<Enemy, 'card'>) => ENEMY[enemyRank(e)].hp;
export const enemyHp = (e: Pick<Enemy, 'card' | 'damage'>) => enemyMaxHp(e) - e.damage;
export const enemyBaseAttack = (e: Pick<Enemy, 'card'>) => ENEMY[enemyRank(e)].attack;
export const enemyAttack = (e: Pick<Enemy, 'card' | 'shield'>) => Math.max(0, enemyBaseAttack(e) - e.shield);

/** An enemy ignores its own suit's power until a Jester cancels that. */
export const isImmune = (e: Pick<Enemy, 'card' | 'immunityCancelled'>, suit: Suit) =>
  !e.immunityCancelled && suitOf(e.card) === suit;

export interface PowerEffect {
  suit: Suit;
  immune: boolean;
  /** The play's base value: cards to heal or draw, shield to add. Clubs: the damage after doubling. */
  amount: number;
}

export type PlayOutcome = 'exact' | 'overkill' | 'survives' | 'jester';

export interface PlayPreview {
  kind: PlayKind;
  /** Sum of the cards' values. */
  base: number;
  damage: number;
  /** One per suit in the play, in resolve order (♥ ♦ ♠ ♣). */
  powers: PowerEffect[];
  hpAfter: number;
  /** The enemy's attack after any new shield. */
  attackAfter: number;
  outcome: PlayOutcome;
}

/**
 * What playing `cards` against `enemy` would do. The engine resolves plays
 * with this, and the client shows it before the player confirms. Heal and draw
 * amounts are nominal: the discard pile or tavern deck may hold fewer cards.
 */
export function previewPlay(
  enemy: Enemy,
  cards: Card[],
): { ok: true; preview: PlayPreview } | { ok: false; error: PlayError } {
  const kind = playKind(cards);
  if (!kind.ok) return kind;
  const hp = enemyHp(enemy);
  if (kind.kind === 'jester') {
    const preview: PlayPreview = {
      kind: 'jester',
      base: 0,
      damage: 0,
      powers: [],
      hpAfter: hp,
      attackAfter: enemyAttack(enemy),
      outcome: 'jester',
    };
    return { ok: true, preview };
  }

  const base = totalValue(cards);
  const suits = SUITS.filter((s) => cards.some((c) => suitOf(c) === s));
  let damage = base;
  let shield = enemy.shield;
  const powers = suits.map((suit): PowerEffect => {
    const immune = isImmune(enemy, suit);
    if (!immune && suit === 'C') damage = base * 2;
    if (!immune && suit === 'S') shield += base;
    return { suit, immune, amount: !immune && suit === 'C' ? base * 2 : base };
  });
  const hpAfter = hp - damage;
  const preview: PlayPreview = {
    kind: kind.kind,
    base,
    damage,
    powers,
    hpAfter,
    attackAfter: enemyAttack({ card: enemy.card, shield }),
    outcome: hpAfter === 0 ? 'exact' : hpAfter < 0 ? 'overkill' : 'survives',
  };
  return { ok: true, preview };
}

/** Whether a hand can cover an attack at all. */
export const canCover = (hand: Card[], attack: number) => totalValue(hand) >= attack;
