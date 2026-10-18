import { cardValue, isJester, rankOf, suitOf, type Card, type Suit } from '@regicide/engine';
import type { LogEntry, RoomView } from '@regicide/server/protocol';
import type { Translate } from './i18n';

export const GLYPH: Record<Suit, string> = { H: '♥', D: '♦', S: '♠', C: '♣' };

export const isRed = (card: Card) => {
  const s = suitOf(card);
  return s === 'H' || s === 'D';
};

/** `7♣`, `J♥`, or "Jester". */
export const cardText = (t: Translate, card: Card) => (isJester(card) ? t('jester') : `${rankOf(card)}${GLYPH[suitOf(card)!]}`);

export const cardsText = (t: Translate, cards: Card[]) => cards.map((c) => cardText(t, c)).join(' + ');

/** "Jack of Hearts" / "红桃杰克". */
export const enemyName = (t: Translate, card: Card) =>
  t('enemyName', { rank: t(`rank.${rankOf(card) as 'J' | 'Q' | 'K'}`), suit: t(`suit.${suitOf(card)!}`) });

export function nameOf(room: RoomView, id: string) {
  return room.players.find((p) => p.id === id)?.name ?? '?';
}

/** Events that start with a player's own move: one per turn. */
export const TURN_EVENTS = new Set(['played', 'jester']);

export function logText(t: Translate, room: RoomView, entry: LogEntry): string {
  const e = entry.event;
  const who = 'player' in e ? nameOf(room, e.player) : '';
  switch (e.type) {
    case 'played':
      return t('log.played', { who, cards: cardsText(t, e.cards), n: e.damage });
    case 'jester':
      return t('log.jester', { who });
    case 'immune':
      return t('log.immune', { glyph: GLYPH[e.suit], power: t(`power.${e.suit}`) });
    case 'healed':
      return t('log.healed', { n: e.count });
    case 'drew':
      return e.draws.length === 0
        ? t('log.drewNone')
        : t('log.drew', { list: e.draws.map((d) => `${nameOf(room, d.player)} ${d.count}`).join(', ') });
    case 'shielded':
      return t('log.shielded', { n: e.amount, attack: e.attack });
    case 'enemyDefeated':
      return t(e.exact ? 'log.exact' : 'log.overkill', { enemy: enemyName(t, e.card), v: cardValue(e.card) });
    case 'enemyRevealed':
      return t('log.revealed', { enemy: enemyName(t, e.card) });
    case 'enemyAttacked':
      return t('log.attacked', { who, n: e.attack });
    case 'discarded':
      return t('log.discarded', { who, cards: cardsText(t, e.cards), n: e.total });
    case 'choseNext':
      return t('log.choseNext', { who, next: nameOf(room, e.next) });
    case 'gameWon':
      return t('log.gameWon');
    case 'gameLost':
      return t(e.reason === 'attack' ? 'log.lostAttack' : 'log.lostEmpty', { who });
  }
}

export type LogTone = 'hit' | 'kill' | 'hurt' | 'info';

export function logTone(entry: LogEntry): LogTone {
  switch (entry.event.type) {
    case 'played':
    case 'jester':
      return 'hit';
    case 'enemyDefeated':
    case 'gameWon':
      return 'kill';
    case 'enemyAttacked':
    case 'discarded':
    case 'gameLost':
      return 'hurt';
    default:
      return 'info';
  }
}
