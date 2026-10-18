import { MAX_HINTS, MAX_MISPLAYS, MAX_SCORE, isColour, isNum } from './cards.js';
import { applyHint, canPlay, score, touches } from './rules.js';
import { drawCard } from './setup.js';
import type { Action, ActionError, ActionResult, Card, EndReason, GameEvent, GameState, HintValue, Player } from './types.js';

const fail = (error: ActionError): ActionResult => ({ ok: false, error });

/**
 * Applies one turn. Pure: the input state is never mutated; on success a new
 * state is returned along with the (all public) events for the action log.
 */
export function applyAction(prev: GameState, action: Action): ActionResult {
  if (prev.phase === 'over') return fail('GAME_OVER');
  const seat = prev.players.findIndex((p) => p.id === action?.player);
  if (seat === -1) return fail('UNKNOWN_PLAYER');
  if (seat !== prev.currentSeat) return fail('NOT_YOUR_TURN');

  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  const player = state.players[seat]!;
  // The last card was drawn on an earlier turn: this is one of the final round's turns.
  const finalTurn = state.turnsLeft !== null;

  switch (action.type) {
    case 'hint': {
      const hint = hintValue(action);
      if (!hint) return fail('INVALID_ACTION');
      if (state.hints <= 0) return fail('NO_HINTS');
      if (action.to === player.id) return fail('SELF_HINT');
      const target = state.players.find((p) => p.id === action.to);
      if (!target) return fail('UNKNOWN_PLAYER');
      const named = touches(target.hand, hint);
      if (named.length === 0) return fail('EMPTY_HINT');
      applyHint(target.hand, hint);
      state.hints--;
      events.push({ type: 'hinted', player: player.id, to: target.id, ...hint, cardIds: named.map((c) => c.id) });
      break;
    }

    case 'discard': {
      if (state.hints >= MAX_HINTS) return fail('HINTS_FULL');
      const card = takeCard(player, action.cardId);
      if (!card) return fail('CARD_NOT_IN_HAND');
      state.discard.push({ colour: card.colour, number: card.number });
      state.hints++;
      const drew = draw(state, player);
      events.push({ type: 'discarded', player: player.id, cardId: card.id, colour: card.colour, number: card.number, drew });
      break;
    }

    case 'play': {
      const card = takeCard(player, action.cardId);
      if (!card) return fail('CARD_NOT_IN_HAND');
      const placed = canPlay(state.fireworks, card);
      if (placed) state.fireworks[card.colour] = card.number;
      else {
        state.discard.push({ colour: card.colour, number: card.number });
        state.misplays++;
      }
      const drew = draw(state, player);
      events.push({ type: 'played', player: player.id, cardId: card.id, colour: card.colour, number: card.number, placed, drew });
      if (placed && card.number === 5 && state.hints < MAX_HINTS) {
        state.hints++;
        events.push({ type: 'hintRegained' });
      }
      break;
    }

    default:
      return fail('INVALID_ACTION');
  }

  endTurn(state, events, finalTurn, prev.deck.length > 0 && state.deck.length === 0);
  return { ok: true, state, events };
}

/** Copies only a well-formed colour or number, never both. */
function hintValue(action: { colour?: unknown; number?: unknown }): HintValue | null {
  const hasColour = action.colour !== undefined;
  const hasNumber = action.number !== undefined;
  if (hasColour === hasNumber) return null;
  if (hasColour) return isColour(action.colour) ? { colour: action.colour } : null;
  return isNum(action.number) ? { number: action.number } : null;
}

function takeCard(player: Player, cardId: unknown): Card | null {
  const i = player.hand.findIndex((c) => c.id === cardId);
  if (i === -1) return null;
  return player.hand.splice(i, 1)[0]!;
}

/** The new card goes in the leftmost slot. */
function draw(state: GameState, player: Player): boolean {
  const card = drawCard(state);
  if (card) player.hand.unshift(card);
  return Boolean(card);
}

function endTurn(state: GameState, events: GameEvent[], finalTurn: boolean, drewLast: boolean) {
  if (state.misplays >= MAX_MISPLAYS) return finish(state, events, 'boom');
  if (score(state) === MAX_SCORE) return finish(state, events, 'perfect');
  if (finalTurn) {
    state.turnsLeft!--;
    if (state.turnsLeft === 0) return finish(state, events, 'deck');
  } else if (drewLast) {
    // This turn drew the last card: everyone, this player included, gets one more turn.
    state.turnsLeft = state.players.length;
    events.push({ type: 'finalRound', turns: state.turnsLeft });
  }
  state.turn++;
  state.currentSeat = (state.currentSeat + 1) % state.players.length;
}

function finish(state: GameState, events: GameEvent[], reason: EndReason) {
  state.phase = 'over';
  state.endReason = reason;
  state.turn++;
  events.push({ type: 'gameOver', reason, score: score(state) });
}
