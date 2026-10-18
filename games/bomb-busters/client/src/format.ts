import type { GameView, Guess, WireView } from '@bomb-busters/engine';
import type { LogEntry, RoomView } from '@bomb-busters/server/protocol';
import type { Translate } from './i18n';

export const guessText = (t: Translate, g: Guess) => (g === 'yellow' ? t('yellow') : String(g));

/** What a wire is cut by: its number, or "yellow". Red and unknown wires have none. */
export function guessOfView(w: WireView): Guess | null {
  if (w.color === 'blue') return w.value!;
  if (w.color === 'yellow') return 'yellow';
  return null;
}

export const sortGuesses = (gs: Guess[]) =>
  [...gs].sort((a, b) => (a === 'yellow' ? 1 : b === 'yellow' ? -1 : a - b));

export function nameOf(room: RoomView, id: string) {
  return room.players.find((p) => p.id === id)?.name ?? '?';
}

/** 1-based position of a wire in its owner's rack, as players call it ("#4"). */
export function wireNumber(game: GameView, wireId: string) {
  for (const p of game.players) {
    const i = p.rack.findIndex((w) => w.id === wireId);
    if (i !== -1) return i + 1;
  }
  return 0;
}

export const ACTION_EVENTS = new Set(['dualCutSuccess', 'dualCutMiss', 'redWireCut', 'soloCut', 'passed']);

export function logText(t: Translate, room: RoomView, entry: LogEntry): string {
  const game = room.game!;
  const e = entry.event;
  const who = 'player' in e ? nameOf(room, e.player) : '';
  switch (e.type) {
    case 'revealed':
      return t('log.revealed', { who });
    case 'dualCutSuccess':
      return t('log.dualCutSuccess', {
        who,
        target: nameOf(room, e.target),
        n: wireNumber(game, e.targetWireId),
        v: guessText(t, e.guess),
      });
    case 'dualCutMiss':
      return t('log.dualCutMiss', {
        who,
        target: nameOf(room, e.target),
        n: wireNumber(game, e.targetWireId),
        v: guessText(t, e.guess),
        actual: guessText(t, e.actual),
        m: e.mistakes,
        allowed: game.mistakesAllowed,
      });
    case 'redWireCut':
      return t('log.redWireCut', { who, target: nameOf(room, e.target), n: wireNumber(game, e.targetWireId) });
    case 'soloCut':
      return t('log.soloCut', { who, count: e.wireIds.length, v: guessText(t, e.value) });
    case 'passed':
      return t('log.passed', { who });
    case 'gameWon':
      return t('log.gameWon');
    case 'gameLost':
      return t(e.reason === 'red-wire' ? 'log.gameLost.red-wire' : 'log.gameLost.detonator');
  }
}

export type LogTone = 'cut' | 'miss' | 'boom' | 'info';

export function logTone(entry: LogEntry): LogTone {
  switch (entry.event.type) {
    case 'dualCutSuccess':
    case 'soloCut':
    case 'gameWon':
      return 'cut';
    case 'dualCutMiss':
      return 'miss';
    case 'redWireCut':
    case 'gameLost':
      return 'boom';
    default:
      return 'info';
  }
}
