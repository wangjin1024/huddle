import { agentsFound, agentsTotal, agreedPick, captainOf, maxGuesses } from './rules.js';
import type { CardType, Clue, Difficulty, GameState, Lang, LossReason, Phase, Pick } from './types.js';

/** What the viewer may do right now. */
export interface LegalActions {
  clue: boolean;
  pick: boolean;
  /** Stop is offered once the turn has had a reveal. */
  stop: boolean;
  /** The viewer is captain and every connected Operative agrees. */
  confirm: boolean;
}

export interface GameView {
  phase: Phase;
  lang: Lang;
  difficulty: Difficulty;
  words: string[];
  /** Each position's type once revealed, else null. */
  revealed: (CardType | null)[];
  /** The full key: only for the Spymaster, or for everyone once the game is over. */
  key: CardType[] | null;
  spymaster: string;
  operatives: string[];
  tokens: number;
  clues: Clue[];
  guesses: number;
  maxGuesses: number;
  picks: Record<string, Pick>;
  /** Who confirms now (the assigned captain, or the next connected Operative). */
  captain: string | null;
  /** The pick all connected Operatives share, if they do. */
  agreed: Pick | null;
  agentsFound: number;
  agentsTotal: number;
  legal: LegalActions;
  lossReason?: LossReason;
}

/**
 * Everything `playerId` is allowed to see. This is the only thing the server
 * sends a client: an Operative gets the type of revealed cards only.
 */
export function viewFor(state: GameState, playerId: string, connected: readonly string[]): GameView {
  const over = state.phase === 'won' || state.phase === 'lost';
  const isOperative = state.operatives.includes(playerId);
  const guessing = state.phase === 'guess';
  const captain = captainOf(state, connected);
  const agreed = guessing ? agreedPick(state, connected) : null;
  const view: GameView = {
    phase: state.phase,
    lang: state.lang,
    difficulty: state.difficulty,
    words: [...state.words],
    revealed: state.key.map((k, i) => (state.revealed[i] ? k : null)),
    key: over || playerId === state.spymaster ? [...state.key] : null,
    spymaster: state.spymaster,
    operatives: [...state.operatives],
    tokens: state.tokens,
    clues: state.clues.map((c) => ({ ...c, reveals: [...c.reveals] })),
    guesses: state.guesses,
    maxGuesses: guessing ? maxGuesses(state) : 0,
    picks: { ...state.picks },
    captain,
    agreed,
    agentsFound: agentsFound(state),
    agentsTotal: agentsTotal(state),
    legal: {
      clue: state.phase === 'clue' && playerId === state.spymaster,
      pick: guessing && isOperative,
      stop: guessing && isOperative && state.guesses > 0,
      confirm: guessing && captain === playerId && agreed !== null,
    },
  };
  if (state.lossReason) view.lossReason = state.lossReason;
  return view;
}
