import { agentsFound, agentsTotal, agreedPick, captainOf, maxGuesses } from './rules.js';
import { BOARD_SIZE } from './setup.js';
import type { Action, ActionError, ActionResult, GameEvent, GameState, Pick, TurnEnd } from './types.js';
import { checkClue } from './words.js';

export const CLUE_NUMBER_MIN = 1;
export const CLUE_NUMBER_MAX = 9;

const fail = (error: ActionError): ActionResult => ({ ok: false, error });

function clone(state: GameState): GameState {
  return {
    ...state,
    words: [...state.words],
    key: [...state.key],
    revealed: [...state.revealed],
    operatives: [...state.operatives],
    clues: state.clues.map((c) => ({ ...c, reveals: [...c.reveals] })),
    picks: { ...state.picks },
  };
}

/** Applies one action. Never mutates `state`. */
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.phase === 'won' || state.phase === 'lost') return fail('GAME_OVER');
  if (!action || typeof action !== 'object') return fail('INVALID_ACTION');
  switch (action.type) {
    case 'clue':
      return giveClue(state, action.player, action.word, action.number);
    case 'pick':
      return pick(state, action.player, action.pick);
    case 'confirm':
      return confirm(state, action.player, action.connected);
    default:
      return fail('INVALID_ACTION');
  }
}

function giveClue(state: GameState, player: string, raw: string, number: number): ActionResult {
  if (state.phase !== 'clue') return fail('WRONG_PHASE');
  if (player !== state.spymaster) return fail('NOT_SPYMASTER');
  if (!Number.isInteger(number) || number < CLUE_NUMBER_MIN || number > CLUE_NUMBER_MAX) return fail('CLUE_NUMBER');
  const check = checkClue(raw, state.words, state.revealed, state.lang);
  if (!check.ok) return fail(check.error);
  const next = clone(state);
  const captain = next.operatives[next.clues.length % next.operatives.length]!;
  next.clues.push({ word: check.word, number, captain, reveals: [] });
  next.tokens -= 1;
  next.phase = 'guess';
  next.guesses = 0;
  next.picks = {};
  return { ok: true, state: next, events: [{ type: 'clueGiven', player, word: check.word, number }] };
}

function pick(state: GameState, player: string, choice: Pick | null): ActionResult {
  if (state.phase !== 'guess') return fail('WRONG_PHASE');
  if (!state.operatives.includes(player)) return fail('NOT_OPERATIVE');
  const next = clone(state);
  if (choice === null) {
    delete next.picks[player];
  } else if (choice === 'stop') {
    if (state.guesses === 0) return fail('STOP_TOO_EARLY');
    next.picks[player] = 'stop';
  } else {
    if (!Number.isInteger(choice) || choice < 0 || choice >= BOARD_SIZE || state.revealed[choice]) return fail('BAD_PICK');
    next.picks[player] = choice;
  }
  return { ok: true, state: next, events: [] };
}

function confirm(state: GameState, player: string, connected: string[]): ActionResult {
  if (state.phase !== 'guess') return fail('WRONG_PHASE');
  if (!state.operatives.includes(player)) return fail('NOT_OPERATIVE');
  if (captainOf(state, connected) !== player) return fail('NOT_CAPTAIN');
  const agreed = agreedPick(state, connected);
  if (agreed === null) return fail('NOT_AGREED');

  const next = clone(state);
  next.picks = {};
  const events: GameEvent[] = [];
  if (agreed === 'stop') {
    endTurn(next, 'stop', events);
    return { ok: true, state: next, events };
  }

  const card = next.key[agreed]!;
  next.revealed[agreed] = true;
  next.guesses += 1;
  next.clues.at(-1)!.reveals.push(agreed);
  events.push({ type: 'revealed', player, index: agreed, word: next.words[agreed]!, card });

  if (card === 'assassin') {
    next.phase = 'lost';
    next.lossReason = 'assassin';
    events.push({ type: 'gameLost', reason: 'assassin' });
  } else if (card === 'agent' && agentsFound(next) === agentsTotal(next)) {
    next.phase = 'won';
    events.push({ type: 'gameWon' });
  } else if (card !== 'agent') {
    endTurn(next, 'miss', events);
  } else if (next.guesses >= maxGuesses(next)) {
    endTurn(next, 'limit', events);
  }
  return { ok: true, state: next, events };
}

/** Back to the Spymaster, unless that was the last timer token. */
function endTurn(state: GameState, reason: TurnEnd, events: GameEvent[]) {
  events.push({ type: 'turnEnded', reason });
  state.guesses = 0;
  if (state.tokens === 0) {
    state.phase = 'lost';
    state.lossReason = 'time';
    events.push({ type: 'gameLost', reason: 'time' });
  } else {
    state.phase = 'clue';
  }
}

/** Clears a player's pick, e.g. when they go offline. */
export function dropPick(state: GameState, player: string): GameState {
  if (!(player in state.picks)) return state;
  const next = clone(state);
  delete next.picks[player];
  return next;
}
