import { canDiscard, canHint, maxScore, score } from './rules.js';
import type { Colour, EndReason, Face, GameState, Knowledge, Num, Phase } from './types.js';

export interface CardView {
  id: string;
  drawnAt: number;
  knowledge: Knowledge;
  /** Missing on the viewer's own cards until the game is over. */
  colour?: Colour;
  number?: Num;
}

export interface PlayerView {
  id: string;
  hand: CardView[];
}

/** What the viewer may do right now. */
export interface LegalActions {
  hint: boolean;
  discard: boolean;
  play: boolean;
}

export interface GameView {
  phase: Phase;
  currentPlayer: string;
  turn: number;
  /** Seat order; each hand leftmost (newest) first. */
  players: PlayerView[];
  deckCount: number;
  hints: number;
  misplays: number;
  fireworks: Record<Colour, number>;
  discard: Face[];
  score: number;
  /** The best score the discard pile still allows. */
  maxScore: number;
  turnsLeft: number | null;
  legal: LegalActions;
  endReason?: EndReason;
}

/**
 * Everything `playerId` is allowed to see. This is the only thing the server
 * sends a client: the viewer's own cards carry only their id and hint
 * knowledge, and the deck is a count.
 */
export function viewFor(state: GameState, playerId: string): GameView {
  const over = state.phase === 'over';
  const current = state.players[state.currentSeat]!;
  const myTurn = !over && current.id === playerId;
  const view: GameView = {
    phase: state.phase,
    currentPlayer: current.id,
    turn: state.turn,
    players: state.players.map((p) => ({
      id: p.id,
      hand: p.hand.map((c) => {
        const card: CardView = {
          id: c.id,
          drawnAt: c.drawnAt,
          knowledge: { ...c.knowledge, notColours: [...c.knowledge.notColours], notNumbers: [...c.knowledge.notNumbers] },
        };
        if (over || p.id !== playerId) {
          card.colour = c.colour;
          card.number = c.number;
        }
        return card;
      }),
    })),
    deckCount: state.deck.length,
    hints: state.hints,
    misplays: state.misplays,
    fireworks: { ...state.fireworks },
    discard: state.discard.map((f) => ({ ...f })),
    score: score(state),
    maxScore: maxScore(state),
    turnsLeft: state.turnsLeft,
    legal: { hint: myTurn && canHint(state), discard: myTurn && canDiscard(state), play: myTurn },
  };
  if (state.endReason) view.endReason = state.endReason;
  return view;
}
