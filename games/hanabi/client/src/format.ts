import { COLOURS, NUMBERS, type Colour, type Face, type HintValue, type Knowledge } from '@hanabi/engine';
import type { LogEntry, RoomView } from '@hanabi/server/protocol';
import type { Translate } from './i18n';

export function nameOf(room: RoomView, id: string) {
  return room.players.find((p) => p.id === id)?.name ?? '?';
}

export const colourName = (t: Translate, c: Colour) => t(`colour.${c}`);

/** "Red 3" / "红 3". */
export const cardName = (t: Translate, f: Face) => t('cardName', { colour: colourName(t, f.colour), n: f.number });

export const hintText = (t: Translate, h: HintValue) => (h.colour ? colourName(t, h.colour) : String(h.number));

/** The colours and numbers a card can still be, given its knowledge. */
export function possible(k: Knowledge) {
  return {
    colours: k.colour ? [k.colour] : COLOURS.filter((c) => !k.notColours.includes(c)),
    numbers: k.number ? [k.number] : NUMBERS.filter((n) => !k.notNumbers.includes(n)),
  };
}

/** "Red 2", "Red, could be 1 2 3", or "nothing yet", for labels and the selected-card line. */
export function knowledgeText(t: Translate, k: Knowledge) {
  const { colours, numbers } = possible(k);
  const parts: string[] = [];
  if (k.colour) parts.push(colourName(t, k.colour));
  else if (colours.length < COLOURS.length) parts.push(t('couldBe', { v: colours.map((c) => colourName(t, c)).join(' ') }));
  if (k.number) parts.push(String(k.number));
  else if (numbers.length < NUMBERS.length) parts.push(t('couldBe', { v: numbers.join(' ') }));
  return parts.length ? parts.join(' · ') : t('knowsNothing');
}

/** Turns are numbered from 1 in the UI. */
export const turnLabel = (t: Translate, turn: number) => t('turnShort', { n: turn + 1 });

export function logText(t: Translate, room: RoomView, entry: LogEntry): string {
  const e = entry.event;
  const who = 'player' in e ? nameOf(room, e.player) : '';
  switch (e.type) {
    case 'hinted':
      return t('log.hinted', {
        who,
        to: nameOf(room, e.to),
        v: e.colour ? colourName(t, e.colour) : String(e.number),
        n: e.cardIds.length,
      });
    case 'played':
      return t(e.placed ? 'log.placed' : 'log.misplayed', { who, card: cardName(t, e) });
    case 'discarded':
      return t('log.discarded', { who, card: cardName(t, e) });
    case 'hintRegained':
      return t('log.hintRegained');
    case 'finalRound':
      return t('log.finalRound');
    case 'gameOver':
      return e.reason === 'boom' ? t('log.boom') : e.reason === 'perfect' ? t('log.perfect') : t('log.deck', { n: e.score });
  }
}

export type LogTone = 'hint' | 'good' | 'bad' | 'info';

export function logTone(entry: LogEntry): LogTone {
  const e = entry.event;
  switch (e.type) {
    case 'hinted':
      return 'hint';
    case 'played':
      return e.placed ? 'good' : 'bad';
    case 'hintRegained':
      return 'good';
    case 'gameOver':
      return e.reason === 'boom' ? 'bad' : 'good';
    default:
      return 'info';
  }
}

/** The rating line for a final score, from the rules guide's table. */
export function ratingKey(score: number) {
  if (score >= 25) return 'rating.25' as const;
  if (score >= 21) return 'rating.21' as const;
  if (score >= 16) return 'rating.16' as const;
  if (score >= 11) return 'rating.11' as const;
  return 'rating.0' as const;
}
