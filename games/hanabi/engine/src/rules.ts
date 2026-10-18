import { COLOURS, COPIES, MAX_HINTS, MAX_MISPLAYS, NUMBERS } from './cards.js';
import type { Card, Colour, Face, GameState, HintValue, Num } from './types.js';

/** The cards in `hand` a hint names. A hint must name at least one. */
export const touches = <T extends Face>(hand: T[], hint: HintValue): T[] =>
  hand.filter((c) => (hint.colour ? c.colour === hint.colour : c.number === hint.number));

export const canPlay = (fireworks: Record<Colour, number>, face: Face) => fireworks[face.colour] === face.number - 1;

export function score(state: Pick<GameState, 'fireworks' | 'misplays'>): number {
  if (state.misplays >= MAX_MISPLAYS) return 0;
  return COLOURS.reduce((sum, c) => sum + state.fireworks[c], 0);
}

/**
 * The best score still reachable: each firework can grow until it needs a
 * number whose every copy is in the discard pile.
 */
export function maxScore(state: Pick<GameState, 'fireworks' | 'misplays' | 'discard'>): number {
  if (state.misplays >= MAX_MISPLAYS) return 0;
  return COLOURS.reduce((sum, c) => {
    let top = state.fireworks[c];
    while (top < 5) {
      const next = (top + 1) as Num;
      const gone = state.discard.filter((f) => f.colour === c && f.number === next).length;
      if (gone >= COPIES[next]) break;
      top = next;
    }
    return sum + top;
  }, 0);
}

export const canHint = (state: GameState) => state.phase === 'play' && state.hints > 0;
export const canDiscard = (state: GameState) => state.phase === 'play' && state.hints < MAX_HINTS;

/** Every colour or number a hint to `hand` could name (it must name at least one card). */
export function hintOptions(hand: Face[]): HintValue[] {
  return [
    ...COLOURS.filter((colour) => hand.some((c) => c.colour === colour)).map((colour) => ({ colour })),
    ...NUMBERS.filter((number) => hand.some((c) => c.number === number)).map((number) => ({ number })),
  ];
}

/** Records a hint on every card of the hand: a fact for the named ones, a "not" for the rest. */
export function applyHint(hand: Card[], hint: HintValue) {
  for (const card of hand) {
    const k = card.knowledge;
    if (hint.colour) {
      if (card.colour === hint.colour) k.colour = hint.colour;
      else if (!k.notColours.includes(hint.colour)) k.notColours.push(hint.colour);
    } else if (hint.number) {
      if (card.number === hint.number) k.number = hint.number;
      else if (!k.notNumbers.includes(hint.number)) k.notNumbers.push(hint.number);
    }
  }
}
