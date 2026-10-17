import {
  canSoloCut,
  guessOf,
  isValidGuess,
  isWon,
  legalActions,
  matches,
  uncutMatching,
} from './rules.js';
import type { Action, ActionError, ActionResult, GameEvent, GameState } from './types.js';

const fail = (error: ActionError): ActionResult => ({ ok: false, error });

/**
 * Applies one action. Pure: the input state is never mutated; on success a new
 * state is returned along with the events to show in the action log.
 */
export function applyAction(prev: GameState, action: Action): ActionResult {
  if (prev.phase === 'won' || prev.phase === 'lost') return fail('GAME_OVER');
  const seat = prev.players.findIndex((p) => p.id === action.player);
  if (seat === -1) return fail('UNKNOWN_PLAYER');

  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  const player = state.players[seat]!;

  if (action.type === 'reveal') {
    if (state.phase !== 'reveal') return fail('WRONG_PHASE');
    if (player.revealDone) return fail('ALREADY_REVEALED');
    const wire = player.rack.find((w) => w.id === action.wireId);
    if (!wire) return fail('UNKNOWN_WIRE');
    if (wire.color !== 'blue') return fail('NOT_A_BLUE_WIRE');
    wire.marked = true;
    player.revealDone = true;
    events.push({ type: 'revealed', player: player.id, wireId: wire.id, value: wire.value });
    if (state.players.every((p) => p.revealDone)) {
      state.phase = 'playing';
      events.push({ type: 'turnStarted', player: state.players[state.currentSeat]!.id });
    }
    return { ok: true, state, events };
  }

  if (state.phase !== 'playing') return fail('WRONG_PHASE');
  if (seat !== state.currentSeat) return fail('NOT_YOUR_TURN');

  switch (action.type) {
    case 'dualCut': {
      if (!isValidGuess(action.guess)) return fail('INVALID_GUESS');
      if (player.rack.some((w) => w.id === action.targetWireId)) return fail('TARGET_IS_OWN_WIRE');
      const target = state.players.find((p) => p.rack.some((w) => w.id === action.targetWireId));
      const targetWire = target?.rack.find((w) => w.id === action.targetWireId);
      if (!target || !targetWire) return fail('UNKNOWN_WIRE');
      if (targetWire.cut) return fail('TARGET_ALREADY_CUT');

      // The own wire is chosen up front, so a wrong guess doesn't need a second round-trip.
      const candidates = uncutMatching(player.rack, action.guess);
      if (candidates.length === 0) return fail('GUESS_NOT_HELD');
      let ownWire = candidates[0]!;
      if (action.ownWireId !== undefined) {
        const chosen = candidates.find((w) => w.id === action.ownWireId);
        if (!chosen) return fail('INVALID_OWN_WIRE');
        ownWire = chosen;
      } else if (candidates.length > 1) {
        return fail('OWN_WIRE_REQUIRED');
      }

      const base = { player: player.id, target: target.id, targetWireId: targetWire.id };
      if (targetWire.color === 'red') {
        targetWire.cut = true;
        events.push({ type: 'redWireCut', ...base });
        return lose(state, events, 'red-wire');
      }
      if (matches(targetWire, action.guess)) {
        targetWire.cut = true;
        ownWire.cut = true;
        events.push({ type: 'dualCutSuccess', ...base, ownWireId: ownWire.id, guess: action.guess });
        break;
      }
      targetWire.marked = true;
      state.mistakes += 1;
      events.push({
        type: 'dualCutMiss',
        ...base,
        guess: action.guess,
        actual: guessOf(targetWire)!,
        mistakes: state.mistakes,
      });
      if (state.mistakes > state.mistakesAllowed) return lose(state, events, 'detonator');
      break;
    }

    case 'soloCut': {
      if (!isValidGuess(action.value) || !canSoloCut(state, player, action.value)) {
        return fail('SOLO_CUT_NOT_ALLOWED');
      }
      const wires = uncutMatching(player.rack, action.value);
      for (const w of wires) w.cut = true;
      events.push({
        type: 'soloCut',
        player: player.id,
        value: action.value,
        wireIds: wires.map((w) => w.id),
      });
      break;
    }

    case 'pass': {
      if (!legalActions(state, player.id).mustPass) return fail('PASS_NOT_ALLOWED');
      events.push({ type: 'passed', player: player.id });
      break;
    }
  }

  if (isWon(state)) {
    state.phase = 'won';
    events.push({ type: 'gameWon' });
    return { ok: true, state, events };
  }
  state.currentSeat = (state.currentSeat + 1) % state.players.length;
  events.push({ type: 'turnStarted', player: state.players[state.currentSeat]!.id });
  return { ok: true, state, events };
}

function lose(state: GameState, events: GameEvent[], reason: 'red-wire' | 'detonator'): ActionResult {
  state.phase = 'lost';
  state.lossReason = reason;
  events.push({ type: 'gameLost', reason });
  return { ok: true, state, events };
}
