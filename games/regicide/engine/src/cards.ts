import type { Card, EnemyRank, Rank, Suit } from './types.js';

/** Also the order suit powers resolve in: ♥ heal, ♦ draw, ♠ shield, ♣ double. */
export const SUITS: Suit[] = ['H', 'D', 'S', 'C'];

export const NUMBER_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
export const ENEMY_RANKS: EnemyRank[] = ['J', 'Q', 'K'];

/** Health and attack when an enemy enters play. Also its value once it's a card in hand. */
export const ENEMY: Record<EnemyRank, { hp: number; attack: number }> = {
  J: { hp: 20, attack: 10 },
  Q: { hp: 30, attack: 15 },
  K: { hp: 40, attack: 20 },
};

export const isJester = (card: Card) => card.startsWith('X');

export function suitOf(card: Card): Suit | null {
  return isJester(card) ? null : (card[0] as Suit);
}

export function rankOf(card: Card): Rank | null {
  return isJester(card) ? null : (card.slice(1) as Rank);
}

export const isEnemyRank = (rank: Rank | null): rank is EnemyRank => rank === 'J' || rank === 'Q' || rank === 'K';

/** A = 1, 2–10 face value, J/Q/K their attack (10/15/20), Jester 0. */
export function cardValue(card: Card): number {
  const rank = rankOf(card);
  if (rank === null) return 0;
  if (rank === 'A') return 1;
  if (isEnemyRank(rank)) return ENEMY[rank].attack;
  return Number(rank);
}

export const totalValue = (cards: Card[]) => cards.reduce((n, c) => n + cardValue(c), 0);

const CARD_RE = /^(?:[HDSC](?:[AJQK]|[2-9]|10)|X[12])$/;
export const isCard = (card: unknown): card is Card => typeof card === 'string' && CARD_RE.test(card);

/** For showing a hand: by value, then suit (so sets sit together), Jesters last. */
export function compareCards(a: Card, b: Card) {
  if (isJester(a) !== isJester(b)) return isJester(a) ? 1 : -1;
  return cardValue(a) - cardValue(b) || SUITS.indexOf(suitOf(a)!) - SUITS.indexOf(suitOf(b)!) || a.localeCompare(b);
}

export const sortCards = (cards: Card[]) => [...cards].sort(compareCards);
