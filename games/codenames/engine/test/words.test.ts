import { describe, expect, it } from 'vitest';
import { WORDS, checkClue, checkPlayerWord, overlaps, type Lang } from '../src/index.js';
import { WORDS as BOARD } from './helpers.js';

describe('built-in word lists', () => {
  for (const lang of ['en', 'zh'] as Lang[]) {
    const list = WORDS[lang];
    it(`${lang}: has exactly 400 unique words`, () => {
      expect(list).toHaveLength(400);
      expect(new Set(list).size).toBe(400);
    });
    it(`${lang}: has no word overlapping another`, () => {
      const clashes: string[] = [];
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) if (overlaps(list[i]!, list[j]!, lang)) clashes.push(`${list[i]}/${list[j]}`);
      expect(clashes).toEqual([]);
    });
  }
  it('en: words are upper-case letters', () => {
    for (const w of WORDS.en) expect(w).toMatch(/^[A-Z]+$/);
  });
  it('zh: words are 1–3 Chinese characters', () => {
    for (const w of WORDS.zh) expect(w).toMatch(/^\p{Script=Han}{1,3}$/u);
  });
});

describe('overlaps', () => {
  it('English: prefix or suffix, ignoring case', () => {
    expect(overlaps('snow', 'SNOWMAN', 'en')).toBe(true);
    expect(overlaps('ISLANDS', 'island', 'en')).toBe(true);
    expect(overlaps('CASE', 'BOOKCASE', 'en')).toBe(true);
    expect(overlaps('ART', 'PARTY', 'en')).toBe(false);
  });
  it('Chinese: containment anywhere', () => {
    expect(overlaps('雪', '雪人', 'zh')).toBe(true);
    expect(overlaps('人', '雪人', 'zh')).toBe(true);
    expect(overlaps('大海', '海浪', 'zh')).toBe(false);
  });
});

describe('checkClue', () => {
  const hidden = Array<boolean>(25).fill(false);

  it('accepts one word and upper-cases English', () => {
    expect(checkClue('  ocean ', BOARD, hidden, 'en')).toEqual({ ok: true, word: 'OCEAN' });
    expect(checkClue("rock'n-roll", BOARD, hidden, 'en')).toMatchObject({ ok: true });
  });

  it('blocks empty, multi-word, punctuation and overlong clues', () => {
    expect(checkClue('  ', BOARD, hidden, 'en')).toMatchObject({ error: 'CLUE_EMPTY' });
    expect(checkClue('deep sea', BOARD, hidden, 'en')).toMatchObject({ error: 'CLUE_NOT_ONE_WORD' });
    expect(checkClue('sea!', BOARD, hidden, 'en')).toMatchObject({ error: 'CLUE_NOT_ONE_WORD' });
    expect(checkClue('A'.repeat(25), BOARD, hidden, 'en')).toMatchObject({ error: 'CLUE_TOO_LONG' });
  });

  it('blocks a clue too close to a hidden board word, but not to a revealed one', () => {
    expect(checkClue('islands', BOARD, hidden, 'en')).toEqual({ ok: false, error: 'CLUE_ON_BOARD', word: 'ISLAND' });
    const revealed = BOARD.map((w) => w === 'ISLAND');
    expect(checkClue('islands', BOARD, revealed, 'en')).toMatchObject({ ok: true });
  });

  it('Chinese: Chinese characters only, at most 4', () => {
    const zh = ['雪人', ...Array<string>(24).fill('桌子')];
    expect(checkClue('航海', zh, hidden, 'zh')).toEqual({ ok: true, word: '航海' });
    expect(checkClue('航 海', zh, hidden, 'zh')).toMatchObject({ error: 'CLUE_NOT_ONE_WORD' });
    expect(checkClue('ocean', zh, hidden, 'zh')).toMatchObject({ error: 'CLUE_NOT_ONE_WORD' });
    expect(checkClue('一二三四五', zh, hidden, 'zh')).toMatchObject({ error: 'CLUE_TOO_LONG' });
    expect(checkClue('雪', zh, hidden, 'zh')).toEqual({ ok: false, error: 'CLUE_ON_BOARD', word: '雪人' });
  });
});

describe('checkPlayerWord', () => {
  it('accepts 1–4 Chinese characters, trimmed', () => {
    expect(checkPlayerWord(' 火锅 ')).toBe('火锅');
    expect(checkPlayerWord('一二三四')).toBe('一二三四');
  });
  it('rejects everything else', () => {
    for (const bad of ['', '一二三四五', 'hotpot', '火 锅', '火锅!', 42, null]) expect(checkPlayerWord(bad)).toBeNull();
  });
});
