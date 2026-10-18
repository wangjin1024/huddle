import type { CardType, Pick } from '@codenames/engine';
import type { PublicEvent, RoomView } from '@codenames/server/protocol';
import type { MessageKey, Translate } from './i18n';

/** One colour per seat for picks and chat. None is blue, red or gold, which mean card types and the Spymaster. */
const SEAT_COLORS = ['#3fc1b0', '#f2994a', '#b48cff', '#ff7eb6', '#7fd36a', '#f5d76e', '#6ec1ff', '#ff9b85'];

export function nameOf(room: RoomView, id: string) {
  return room.players.find((p) => p.id === id)?.name ?? '?';
}

export function colorOf(room: RoomView, id: string) {
  const seat = room.players.findIndex((p) => p.id === id);
  return SEAT_COLORS[(seat < 0 ? 0 : seat) % SEAT_COLORS.length]!;
}

export const initialOf = (name: string) => ([...name][0] ?? '?').toUpperCase();

export const typeKey = (type: CardType): MessageKey => `type.${type}`;

export function pickText(t: Translate, room: RoomView, pick: Pick | undefined) {
  if (pick === undefined) return t('thinking');
  if (pick === 'stop') return t('stop');
  return room.game?.words[pick] ?? '?';
}

/** A game event as a chat system line. */
export function eventText(t: Translate, room: RoomView, e: PublicEvent): string {
  switch (e.type) {
    case 'clueGiven':
      return t('chat.clue', { who: nameOf(room, e.player), word: e.word, n: e.number });
    case 'revealed':
      return t('chat.revealed', { who: nameOf(room, e.player) });
    case 'gameWon':
      return t('chat.won');
    case 'gameLost':
      return t(e.reason === 'assassin' ? 'chat.lostAssassin' : 'chat.lostTime');
  }
}
