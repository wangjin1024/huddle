export type Suit = 'H' | 'D' | 'S' | 'C';

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

/**
 * `<suit><rank>` (`H7`, `SA`, `CK`) or a Jester (`X1`, `X2`). Ids are the cards
 * themselves: hidden cards are never sent to a client at all, so they leak nothing.
 */
export type Card = string;

export type EnemyRank = 'J' | 'Q' | 'K';

/** The enemy being fought: the top castle card plus what has been done to it. */
export interface Enemy {
  card: Card;
  /** Damage taken so far. Health left = max health − damage. */
  damage: number;
  /** Total Spades shield played against it. Attack = base attack − shield, never below 0. */
  shield: number;
  /** A Jester has cancelled its suit immunity for the rest of this fight. */
  immunityCancelled: boolean;
}

export interface Player {
  id: string;
  hand: Card[];
}

/**
 * `play`: the current player plays cards (step 1).
 * `discard`: the enemy survived; the current player discards to cover its attack (step 4).
 * `chooseNext`: a Jester was played; its player picks who goes next.
 */
export type Phase = 'play' | 'discard' | 'chooseNext' | 'won' | 'lost';

/** `attack`: a hand couldn't cover the enemy's attack. `emptyHand`: a turn started with no cards. */
export type LossReason = 'attack' | 'emptyHand';

export interface Defeated {
  card: Card;
  /** Health hit exactly 0, so the card went on top of the tavern deck. */
  exact: boolean;
}

export interface GameState {
  /** Seat order; play goes clockwise in this order. */
  players: Player[];
  /** Max hand size for this player count. */
  handSize: number;
  /** Jesters shuffled into the tavern deck at setup. */
  jesters: number;
  phase: Phase;
  currentSeat: number;
  enemy: Enemy;
  /** Enemies still to come, next first (J…, then Q…, then K…). */
  castle: Card[];
  /** The player deck, top first. Its order is never sent to a client. */
  tavern: Card[];
  /** The top tavern card is public: an exactly-killed enemy put there face up. */
  tavernTopPublic: boolean;
  /** Face up and public. */
  discard: Card[];
  /** Cards played against the current enemy; discarded when it's defeated. */
  played: Card[];
  defeated: Defeated[];
  lossReason?: LossReason;
}

export type Action =
  | { type: 'play'; player: string; cards: Card[] }
  | { type: 'discard'; player: string; cards: Card[] }
  | { type: 'chooseNext'; player: string; next: string };

export interface Draw {
  player: string;
  count: number;
}

export type GameEvent =
  | { type: 'turnStarted'; player: string }
  | { type: 'played'; player: string; cards: Card[]; damage: number }
  | { type: 'jester'; player: string }
  /** A suit power the enemy ignored. */
  | { type: 'immune'; suit: Suit }
  | { type: 'healed'; count: number }
  /** Who drew how many; which cards stays private. */
  | { type: 'drew'; draws: Draw[] }
  | { type: 'shielded'; amount: number; attack: number }
  | { type: 'enemyDefeated'; card: Card; exact: boolean }
  | { type: 'enemyRevealed'; card: Card }
  | { type: 'enemyAttacked'; player: string; attack: number }
  | { type: 'discarded'; player: string; cards: Card[]; total: number }
  | { type: 'choseNext'; player: string; next: string }
  | { type: 'gameWon' }
  | { type: 'gameLost'; reason: LossReason; player: string };

/** Why a set of cards isn't a legal play. */
export type PlayError = 'NO_CARDS' | 'INVALID_CARDS' | 'JESTER_ALONE' | 'ACE_PAIR_ONLY' | 'SET_TOO_HIGH' | 'MIXED_RANKS';

export type ActionError =
  | PlayError
  | 'GAME_OVER'
  | 'INVALID_ACTION'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'UNKNOWN_PLAYER'
  | 'CARD_NOT_IN_HAND'
  | 'NOT_ENOUGH_DAMAGE_COVER';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

/** Returns a float in [0, 1). Injectable so games are reproducible in tests. */
export type Rng = () => number;
