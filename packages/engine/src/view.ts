import { BLUE_VALUES, guessOf, legalActions, type LegalActions } from './rules.js';
import type { Difficulty, GameState, Guess, LossReason, Phase, WireColor } from './types.js';

/**
 * One wire as a given viewer sees it. Hidden wires carry only `id`, `cut` and
 * `marker`; `color` and `value` are present only when the viewer may see them.
 */
export interface WireView {
  id: string;
  cut: boolean;
  color?: WireColor;
  value?: number;
  /** The real value shown by a marker next to this wire, if any. */
  marker?: Guess;
}

export interface PlayerView {
  id: string;
  rack: WireView[];
  revealDone: boolean;
}

export interface GameView {
  you: string;
  difficulty: Difficulty;
  phase: Phase;
  currentPlayer: string;
  mistakes: number;
  mistakesAllowed: number;
  lossReason?: LossReason;
  players: PlayerView[];
  /** Cut count per blue value, 1–12. */
  blueCut: Record<number, number>;
  yellowCut: number;
  yellowTotal: number;
  /**
   * Values of the red and yellow wires in this game, announced to everyone at
   * setup (sorted). Who holds them stays hidden.
   */
  inPlay: { red: number[]; yellow: number[] };
  legal: LegalActions;
}

/**
 * Builds what `viewerId` is allowed to see. This is the only thing the server
 * may send to a client: other players' uncut wires never include color or value.
 */
export function viewFor(state: GameState, viewerId: string): GameView {
  const over = state.phase === 'won' || state.phase === 'lost';
  const blueCut: Record<number, number> = {};
  for (let v = 1; v <= BLUE_VALUES; v++) blueCut[v] = 0;
  let yellowCut = 0;
  let yellowTotal = 0;
  const inPlay: GameView['inPlay'] = { red: [], yellow: [] };

  const players = state.players.map((p) => {
    const own = p.id === viewerId;
    // Setup reveals are simultaneous, so others' choices stay hidden until all have chosen.
    const markersVisible = own || state.phase !== 'reveal';
    const rack = p.rack.map((w): WireView => {
      if (w.color === 'red') inPlay.red.push(w.value);
      if (w.color === 'yellow') {
        inPlay.yellow.push(w.value);
        yellowTotal += 1;
        if (w.cut) yellowCut += 1;
      } else if (w.color === 'blue' && w.cut) {
        blueCut[w.value]! += 1;
      }
      const view: WireView = { id: w.id, cut: w.cut };
      if (own || w.cut || over) {
        view.color = w.color;
        view.value = w.value;
      }
      if (w.marked && markersVisible) view.marker = guessOf(w)!;
      return view;
    });
    return { id: p.id, rack, revealDone: p.revealDone };
  });

  const view: GameView = {
    you: viewerId,
    difficulty: state.difficulty,
    phase: state.phase,
    currentPlayer: state.players[state.currentSeat]!.id,
    mistakes: state.mistakes,
    mistakesAllowed: state.mistakesAllowed,
    players,
    blueCut,
    yellowCut,
    yellowTotal,
    inPlay: { red: inPlay.red.sort((a, b) => a - b), yellow: inPlay.yellow.sort((a, b) => a - b) },
    legal: legalActions(state, viewerId),
  };
  if (state.lossReason) view.lossReason = state.lossReason;
  return view;
}
