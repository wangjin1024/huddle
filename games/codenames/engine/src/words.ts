import type { ClueError, Lang } from './types.js';
import { EN_WORDS } from './words/en.js';
import { ZH_WORDS } from './words/zh.js';

export const WORDS: Record<Lang, readonly string[]> = { en: EN_WORDS, zh: ZH_WORDS };

export const CLUE_MAX = { en: 24, zh: 4 } as const;
/** Player-added words (Chinese rooms): 1–4 characters. */
export const PLAYER_WORD_MAX = 4;
export const PLAYER_WORDS_EACH = 3;

const HAN = /^\p{Script=Han}+$/u;
const EN_WORD = /^\p{L}[\p{L}'-]*$/u;

/** Trims, and upper-cases English. */
export const normalize = (word: string, lang: Lang) => (lang === 'en' ? word.trim().toUpperCase() : word.trim());

/**
 * Two words too close to share a board or a clue. English: one starts or ends
 * with the other (SNOW / SNOWMAN, ISLAND / ISLANDS, CASE / BOOKCASE), so ART
 * and PARTY stay fine. Chinese: one contains the other (雪 / 雪人).
 */
export function overlaps(a: string, b: string, lang: Lang): boolean {
  if (lang === 'en') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x.startsWith(y) || y.startsWith(x) || x.endsWith(y) || y.endsWith(x);
  }
  return a.includes(b) || b.includes(a);
}

export type ClueCheck = { ok: true; word: string } | { ok: false; error: ClueError; word?: string };

/**
 * The clue rules the app can check (PRD §5.5): one word, a length cap, and no
 * overlap with a word still hidden on the board. On `CLUE_ON_BOARD`, `word`
 * is the board word it clashes with.
 */
export function checkClue(raw: string, words: string[], revealed: boolean[], lang: Lang): ClueCheck {
  const word = normalize(String(raw ?? ''), lang);
  if (!word) return { ok: false, error: 'CLUE_EMPTY' };
  if (!(lang === 'en' ? EN_WORD : HAN).test(word)) return { ok: false, error: 'CLUE_NOT_ONE_WORD' };
  if ([...word].length > CLUE_MAX[lang]) return { ok: false, error: 'CLUE_TOO_LONG' };
  const clash = words.find((w, i) => !revealed[i] && overlaps(word, w, lang));
  if (clash) return { ok: false, error: 'CLUE_ON_BOARD', word: clash };
  return { ok: true, word };
}

/** A player-added Chinese word: 1–4 Chinese characters. Returns the trimmed word, or null. */
export function checkPlayerWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const word = raw.trim();
  return HAN.test(word) && [...word].length <= PLAYER_WORD_MAX ? word : null;
}
