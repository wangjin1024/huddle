import { describe, expect, it } from 'vitest';
import { WORDS, createGame, overlaps } from '../src/index.js';
import { seeded } from './helpers.js';

const players = ['p1', 'p2', 'p3', 'p4'];

describe('createGame', () => {
  it('deals 25 distinct words and a 9/8/7/1 key', () => {
    const g = createGame({ playerIds: players, spymaster: 'p1', lang: 'en', rng: seeded(1) });
    expect(new Set(g.words).size).toBe(25);
    for (const w of g.words) expect(WORDS.en).toContain(w);
    const count = (t: string) => g.key.filter((k) => k === t).length;
    expect([count('agent'), count('rival'), count('bystander'), count('assassin')]).toEqual([9, 8, 7, 1]);
    expect(g.phase).toBe('clue');
  });

  it('gives 9, 7 or 5 timer tokens by difficulty, medium by default', () => {
    const tokens = (difficulty?: 'easy' | 'medium' | 'hard') =>
      createGame({ playerIds: players, spymaster: 'p1', lang: 'en', difficulty, rng: seeded(1) }).tokens;
    expect([tokens('easy'), tokens('medium'), tokens('hard'), tokens()]).toEqual([9, 7, 5, 7]);
  });

  it('seats Operatives in order from the seat after the Spymaster', () => {
    expect(createGame({ playerIds: players, spymaster: 'p3', lang: 'en', rng: seeded(2) }).operatives).toEqual(['p4', 'p1', 'p2']);
  });

  it('refuses 1 or 9 players', () => {
    expect(() => createGame({ playerIds: ['p1'], spymaster: 'p1', lang: 'en' })).toThrow();
    expect(() => createGame({ playerIds: Array.from({ length: 9 }, (_, i) => `p${i}`), spymaster: 'p0', lang: 'en' })).toThrow();
  });

  it('puts every player word on the board and skips built-in words that overlap them', () => {
    const extras = ['火锅', '熊猫人', '雪'];
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame({ playerIds: players, spymaster: 'p1', lang: 'zh', extraWords: extras, rng: seeded(seed) });
      for (const x of extras) expect(g.words).toContain(x);
      const builtIn = g.words.filter((w) => !extras.includes(w));
      expect(builtIn).toHaveLength(22);
      for (const w of builtIn) for (const x of extras) expect(overlaps(w, x, 'zh')).toBe(false);
    }
  });

  it('fills a board with 24 player words plus one built-in', () => {
    // 48 distinct characters → 24 two-character words, none containing another.
    const chars = [...'甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥金木水火土日月星风云山川江河湖海春夏秋冬东西南北前后'];
    const unique = Array.from({ length: 24 }, (_, i) => chars[2 * i]! + chars[2 * i + 1]!);
    const g = createGame({ playerIds: players, spymaster: 'p1', lang: 'zh', extraWords: unique, rng: seeded(3) });
    expect(g.words).toHaveLength(25);
    for (const x of unique) expect(g.words).toContain(x);
  });

  it("avoids the last board's words while the list has enough others", () => {
    const first = createGame({ playerIds: players, spymaster: 'p1', lang: 'en', rng: seeded(4) });
    for (let seed = 5; seed < 15; seed++) {
      const next = createGame({ playerIds: players, spymaster: 'p1', lang: 'en', avoidWords: first.words, rng: seeded(seed) });
      for (const w of next.words) expect(first.words).not.toContain(w);
    }
  });
});
