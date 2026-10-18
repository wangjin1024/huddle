import { ENEMY_RANKS, rankOf, sortCards } from './cards.js';
import { enemyAttack, enemyBaseAttack, enemyHp, enemyMaxHp } from './rules.js';
import type { Card, Defeated, Enemy, EnemyRank, GameState, LossReason, Phase } from './types.js';

export interface PlayerView {
  id: string;
  /** Hand sizes are public; the cards are not. */
  handCount: number;
}

export interface EnemyView extends Enemy {
  hp: number;
  maxHp: number;
  baseAttack: number;
  /** Base attack minus shield, never below 0. */
  attack: number;
}

/** What the viewer may do right now. */
export interface LegalActions {
  play: boolean;
  /** The attack to cover by discarding, when that's the viewer's job now. */
  discard: number | null;
  chooseNext: boolean;
}

export interface GameView {
  phase: Phase;
  currentPlayer: string;
  handSize: number;
  jesters: number;
  players: PlayerView[];
  /** The viewer's own hand, sorted by value. */
  hand: Card[];
  enemy: EnemyView;
  /** Enemies still to come (after the current one), by rank. Their order stays hidden. */
  castleLeft: Record<EnemyRank, number>;
  defeated: Defeated[];
  tavernCount: number;
  /** Set when the top tavern card is known: an exactly-killed enemy put there face up. */
  tavernTop: Card | null;
  /** Public, sorted by value. */
  discard: Card[];
  played: Card[];
  legal: LegalActions;
  lossReason?: LossReason;
}

/**
 * Everything `playerId` is allowed to see. This is the only thing the server
 * sends a client: other hands become counts, and the tavern deck a count.
 */
export function viewFor(state: GameState, playerId: string): GameView {
  const me = state.players.find((p) => p.id === playerId);
  const current = state.players[state.currentSeat]!;
  const myTurn = current.id === playerId;
  const castleLeft = Object.fromEntries(
    ENEMY_RANKS.map((r) => [r, state.castle.filter((c) => rankOf(c) === r).length]),
  ) as Record<EnemyRank, number>;
  const view: GameView = {
    phase: state.phase,
    currentPlayer: current.id,
    handSize: state.handSize,
    jesters: state.jesters,
    players: state.players.map((p) => ({ id: p.id, handCount: p.hand.length })),
    hand: me ? sortCards(me.hand) : [],
    enemy: {
      ...state.enemy,
      hp: enemyHp(state.enemy),
      maxHp: enemyMaxHp(state.enemy),
      baseAttack: enemyBaseAttack(state.enemy),
      attack: enemyAttack(state.enemy),
    },
    castleLeft,
    defeated: state.defeated.map((d) => ({ ...d })),
    tavernCount: state.tavern.length,
    tavernTop: state.tavernTopPublic ? (state.tavern[0] ?? null) : null,
    discard: sortCards(state.discard),
    played: [...state.played],
    legal: {
      play: myTurn && state.phase === 'play',
      discard: myTurn && state.phase === 'discard' ? enemyAttack(state.enemy) : null,
      chooseNext: myTurn && state.phase === 'chooseNext',
    },
  };
  if (state.lossReason) view.lossReason = state.lossReason;
  return view;
}
