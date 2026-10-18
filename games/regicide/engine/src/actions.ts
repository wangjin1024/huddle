import { isCard, totalValue } from './cards.js';
import { canCover, enemyAttack, enemyHp, previewPlay } from './rules.js';
import { newEnemy, shuffle } from './setup.js';
import type { Action, ActionError, ActionResult, Card, Draw, GameEvent, GameState, LossReason, Rng } from './types.js';

const fail = (error: ActionError): ActionResult => ({ ok: false, error });

/**
 * Applies one action. Pure apart from `rng` (used by Hearts to shuffle the
 * discard pile): the input state is never mutated; on success a new state is
 * returned along with the events to show in the action log.
 */
export function applyAction(prev: GameState, action: Action, rng: Rng = Math.random): ActionResult {
  if (prev.phase === 'won' || prev.phase === 'lost') return fail('GAME_OVER');
  const seat = prev.players.findIndex((p) => p.id === action.player);
  if (seat === -1) return fail('UNKNOWN_PLAYER');
  if (seat !== prev.currentSeat) return fail('NOT_YOUR_TURN');

  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  const player = state.players[seat]!;

  switch (action.type) {
    case 'play': {
      if (state.phase !== 'play') return fail('WRONG_PHASE');
      if (!Array.isArray(action.cards)) return fail('INVALID_CARDS');
      const result = previewPlay(state.enemy, action.cards);
      if (!result.ok) return fail(result.error);
      if (!takeFromHand(player.hand, action.cards)) return fail('CARD_NOT_IN_HAND');
      state.played.push(...action.cards);
      const { preview } = result;

      if (preview.kind === 'jester') {
        state.enemy.immunityCancelled = true;
        state.phase = 'chooseNext';
        events.push({ type: 'jester', player: player.id });
        return { ok: true, state, events };
      }

      events.push({ type: 'played', player: player.id, cards: action.cards, damage: preview.damage });
      for (const power of preview.powers) {
        if (power.immune) events.push({ type: 'immune', suit: power.suit });
        else if (power.suit === 'H') events.push({ type: 'healed', count: heal(state, preview.base, rng) });
        else if (power.suit === 'D') events.push({ type: 'drew', draws: draw(state, seat, preview.base) });
        else if (power.suit === 'S') {
          state.enemy.shield += preview.base;
          events.push({ type: 'shielded', amount: preview.base, attack: enemyAttack(state.enemy) });
        }
        // Clubs: the doubled damage is already in `preview.damage`.
      }

      state.enemy.damage += preview.damage;
      if (enemyHp(state.enemy) <= 0) {
        if (!defeatEnemy(state, events)) startTurn(state, events, seat + 1);
        return { ok: true, state, events };
      }

      const attack = enemyAttack(state.enemy);
      if (attack === 0) {
        startTurn(state, events, seat + 1);
        return { ok: true, state, events };
      }
      events.push({ type: 'enemyAttacked', player: player.id, attack });
      if (!canCover(player.hand, attack)) return { ok: true, state: lose(state, events, 'attack', player.id), events };
      state.phase = 'discard';
      return { ok: true, state, events };
    }

    case 'discard': {
      if (state.phase !== 'discard') return fail('WRONG_PHASE');
      if (!Array.isArray(action.cards) || !action.cards.every(isCard) || new Set(action.cards).size !== action.cards.length) {
        return fail('INVALID_CARDS');
      }
      const total = totalValue(action.cards);
      if (total < enemyAttack(state.enemy)) return fail('NOT_ENOUGH_DAMAGE_COVER');
      if (!takeFromHand(player.hand, action.cards)) return fail('CARD_NOT_IN_HAND');
      state.discard.push(...action.cards);
      events.push({ type: 'discarded', player: player.id, cards: action.cards, total });
      startTurn(state, events, seat + 1);
      return { ok: true, state, events };
    }

    case 'chooseNext': {
      if (state.phase !== 'chooseNext') return fail('WRONG_PHASE');
      const next = state.players.findIndex((p) => p.id === action.next);
      if (next === -1) return fail('UNKNOWN_PLAYER');
      events.push({ type: 'choseNext', player: player.id, next: action.next });
      startTurn(state, events, next);
      return { ok: true, state, events };
    }

    default:
      return fail('INVALID_ACTION');
  }
}

/** Removes `cards` from `hand` in place, or returns false (leaving it untouched) if any isn't there. */
function takeFromHand(hand: Card[], cards: Card[]): boolean {
  if (!cards.every((c) => hand.includes(c))) return false;
  for (const c of cards) hand.splice(hand.indexOf(c), 1);
  return true;
}

/** ♥: shuffle the discard pile and put up to `amount` of it under the tavern deck. */
function heal(state: GameState, amount: number, rng: Rng): number {
  const pile = shuffle(state.discard, rng);
  const healed = pile.splice(0, amount);
  state.tavern.push(...healed);
  state.discard = pile;
  return healed.length;
}

/** ♦: deal up to `amount` cards one at a time, clockwise from `seat`, skipping full hands. */
function draw(state: GameState, seat: number, amount: number): Draw[] {
  const counts = new Map<string, number>();
  const n = state.players.length;
  for (let i = 0; amount > 0 && state.tavern.length > 0; i++) {
    if (state.players.every((p) => p.hand.length >= state.handSize)) break;
    const p = state.players[(seat + i) % n]!;
    if (p.hand.length >= state.handSize) continue;
    p.hand.push(state.tavern.shift()!);
    state.tavernTopPublic = false;
    counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    amount--;
  }
  return state.players.filter((p) => counts.has(p.id)).map((p) => ({ player: p.id, count: counts.get(p.id)! }));
}

/** Moves the defeated enemy and the cards played against it. Returns true if that won the game. */
function defeatEnemy(state: GameState, events: GameEvent[]): boolean {
  const { card } = state.enemy;
  const exact = enemyHp(state.enemy) === 0;
  state.discard.push(...state.played);
  state.played = [];
  if (exact) {
    state.tavern.unshift(card);
    state.tavernTopPublic = true;
  } else {
    state.discard.push(card);
  }
  state.defeated.push({ card, exact });
  events.push({ type: 'enemyDefeated', card, exact });

  const next = state.castle.shift();
  if (!next) {
    state.phase = 'won';
    events.push({ type: 'gameWon' });
    return true;
  }
  state.enemy = newEnemy(next);
  events.push({ type: 'enemyRevealed', card: next });
  return false;
}

/** Starts `seat`'s turn. A player who must play with an empty hand loses the game for the team. */
function startTurn(state: GameState, events: GameEvent[], seat: number) {
  state.currentSeat = seat % state.players.length;
  state.phase = 'play';
  const player = state.players[state.currentSeat]!;
  if (player.hand.length === 0) lose(state, events, 'emptyHand', player.id);
  else events.push({ type: 'turnStarted', player: player.id });
}

function lose(state: GameState, events: GameEvent[], reason: LossReason, player: string): GameState {
  state.phase = 'lost';
  state.lossReason = reason;
  events.push({ type: 'gameLost', reason, player });
  return state;
}
