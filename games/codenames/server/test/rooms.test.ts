import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/rooms.js';

function room(names = ['Ben', 'Chen', 'Dana'], lang: 'en' | 'zh' = 'en') {
  let clock = 0;
  const rooms = new RoomManager(Math.random, () => clock);
  const host = rooms.create('Lin', lang);
  if (!host.ok) throw new Error(host.error);
  const ids = [host.playerId];
  for (const name of names) {
    const r = rooms.join(host.code, name);
    if (!r.ok) throw new Error(r.error);
    ids.push(r.playerId);
  }
  for (const id of ids) rooms.setConnected(host.code, id, true);
  return { rooms, code: host.code, ids, tick: (ms: number) => (clock += ms) };
}

/** Ids by role once a game has started. */
function roles(rooms: RoomManager, code: string) {
  const g = rooms.rooms.get(code)!.game!;
  return { spy: g.spymaster, ops: g.operatives };
}

describe('lobby', () => {
  it('needs 2 players and caps rooms at 8', () => {
    const solo = room([]);
    expect(solo.rooms.start(solo.code, solo.ids[0]!)).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
    const { rooms, code } = room(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']);
    expect(rooms.join(code, 'Late')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('defaults the Spymaster to the host and lets only the host change it or the language', () => {
    const { rooms, code, ids } = room();
    expect(rooms.viewFor(code, ids[1]!)!.spymaster).toBe(ids[0]);
    expect(rooms.settings(code, ids[1]!, { spymaster: ids[1] })).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.settings(code, ids[0]!, { spymaster: ids[2], lang: 'zh' })).toEqual({ ok: true });
    expect(rooms.viewFor(code, ids[1]!)).toMatchObject({ spymaster: ids[2], lang: 'zh' });
    expect(rooms.settings(code, ids[0]!, { spymaster: 'nobody' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(rooms.settings(code, ids[0]!, { lang: 'fr' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(rooms.settings(code, ids[0]!, { spymaster: 'random' })).toEqual({ ok: true });
    expect(ids).toContain(rooms.viewFor(code, ids[0]!)!.spymaster);
  });

  it('defaults to medium (7 tokens) and lets the host pick a difficulty', () => {
    const { rooms, code, ids } = room();
    expect(rooms.viewFor(code, ids[0]!)!.difficulty).toBe('medium');
    expect(rooms.settings(code, ids[1]!, { difficulty: 'hard' })).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.settings(code, ids[0]!, { difficulty: 'extreme' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(rooms.settings(code, ids[0]!, { difficulty: 'hard' })).toEqual({ ok: true });
    rooms.start(code, ids[0]!);
    expect(rooms.viewFor(code, ids[1]!)!.game).toMatchObject({ difficulty: 'hard', tokens: 5 });
    expect(rooms.settings(code, ids[0]!, { difficulty: 'easy' })).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });

  it('starts with the chosen Spymaster, who sees the key', () => {
    const { rooms, code, ids } = room();
    rooms.settings(code, ids[0]!, { spymaster: ids[2] });
    expect(rooms.start(code, ids[0]!)).toEqual({ ok: true });
    expect(rooms.viewFor(code, ids[2]!)!.game!.key).toHaveLength(25);
    expect(rooms.viewFor(code, ids[0]!)!.game!.key).toBeNull();
  });
});

describe('player words', () => {
  it('only in Chinese rooms, in the lobby, up to 3 each', () => {
    const en = room();
    expect(en.rooms.addWord(en.code, en.ids[0]!, '火锅')).toEqual({ ok: false, error: 'WORDS_ZH_ONLY' });

    const { rooms, code, ids } = room(['Ben'], 'zh');
    expect(rooms.addWord(code, ids[1]!, 'hotpot')).toEqual({ ok: false, error: 'WORD_INVALID' });
    for (const w of ['火锅', '熊猫', '饺子']) expect(rooms.addWord(code, ids[1]!, w)).toEqual({ ok: true });
    expect(rooms.addWord(code, ids[1]!, '月亮')).toEqual({ ok: false, error: 'WORDS_FULL' });
  });

  it('refuses a word overlapping anyone’s, without saying whose', () => {
    const { rooms, code, ids } = room(['Ben'], 'zh');
    rooms.addWord(code, ids[0]!, '雪人');
    expect(rooms.addWord(code, ids[1]!, '雪')).toEqual({ ok: false, error: 'WORD_OVERLAP' });
    expect(rooms.addWord(code, ids[1]!, '雪人')).toEqual({ ok: false, error: 'WORD_OVERLAP' });
  });

  it('shows others only the count; the host sees all and can remove any', () => {
    const { rooms, code, ids } = room(['Ben', 'Chen'], 'zh');
    rooms.addWord(code, ids[1]!, '火锅');
    rooms.addWord(code, ids[2]!, '熊猫');
    expect(rooms.viewFor(code, ids[1]!)!.words).toEqual({ mine: ['火锅'], count: 2, all: null });
    expect(JSON.stringify(rooms.viewFor(code, ids[1]!))).not.toContain('熊猫');
    expect(rooms.viewFor(code, ids[0]!)!.words.all).toEqual([
      { word: '火锅', by: ids[1] },
      { word: '熊猫', by: ids[2] },
    ]);
    expect(rooms.removeWord(code, ids[1]!, '熊猫')).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.removeWord(code, ids[0]!, '熊猫')).toEqual({ ok: true });
    expect(rooms.removeWord(code, ids[1]!, '火锅')).toEqual({ ok: true });
    expect(rooms.viewFor(code, ids[0]!)!.words.count).toBe(0);
  });

  it('puts every added word on the board, then clears them', () => {
    const { rooms, code, ids } = room(['Ben', 'Chen'], 'zh');
    for (const [i, w] of ['火锅', '熊猫', '烧烤'].entries()) rooms.addWord(code, ids[i]!, w);
    rooms.start(code, ids[0]!);
    const words = rooms.rooms.get(code)!.game!.words;
    for (const w of ['火锅', '熊猫', '烧烤']) expect(words).toContain(w);
    expect(rooms.viewFor(code, ids[0]!)!.words.count).toBe(0);
    expect(rooms.addWord(code, ids[1]!, '月亮')).toEqual({ ok: false, error: 'NOT_LOBBY' });
  });
});

describe('play', () => {
  it('only accepts well-formed actions', () => {
    const { rooms, code, ids } = room();
    rooms.start(code, ids[0]!);
    const bad = [{ type: 'clue', word: 3, number: 2 }, { type: 'clue', word: 'sea' }, { type: 'pick', pick: 'yes' }, { type: 'pick', pick: 1.5 }, { type: 'cheat' }, null];
    for (const action of bad) expect(rooms.act(code, ids[0]!, action as never)).toEqual({ ok: false, error: 'BAD_REQUEST' });
  });

  it('needs every connected Operative to agree, and a disconnect clears their pick', () => {
    const { rooms, code } = room();
    rooms.start(code, rooms.rooms.get(code)!.hostId);
    const { spy, ops } = roles(rooms, code);
    expect(rooms.act(code, spy, { type: 'clue', word: 'zzzq', number: 2 })).toEqual({ ok: true });
    const captain = rooms.viewFor(code, ops[0]!)!.game!.captain!;
    expect(captain).toBe(ops[0]);
    rooms.act(code, ops[0]!, { type: 'pick', pick: 4 });
    rooms.act(code, ops[1]!, { type: 'pick', pick: 4 });
    rooms.act(code, ops[2]!, { type: 'pick', pick: 7 });
    expect(rooms.act(code, captain, { type: 'confirm' })).toEqual({ ok: false, error: 'NOT_AGREED' });
    rooms.setConnected(code, ops[2]!, false);
    expect(rooms.rooms.get(code)!.game!.picks[ops[2]!]).toBeUndefined();
    expect(rooms.act(code, captain, { type: 'confirm' })).toEqual({ ok: true });
    expect(rooms.rooms.get(code)!.game!.revealed[4]).toBe(true);
  });

  it('passes the Spymaster role to the next seat on Play again', () => {
    const { rooms, code, ids } = room();
    rooms.start(code, ids[0]!);
    const g = rooms.rooms.get(code)!;
    g.game = { ...g.game!, phase: 'won' };
    expect(rooms.playAgain(code, ids[0]!)).toEqual({ ok: true });
    expect(rooms.viewFor(code, ids[0]!)).toMatchObject({ spymaster: ids[1], game: null, chat: [] });
  });
});

describe('chat', () => {
  it('keeps only the current round: cleared when a turn ends', () => {
    const { rooms, code, ids } = room();
    rooms.start(code, ids[0]!);
    const { spy, ops } = roles(rooms, code);
    rooms.chat(code, ops[0]!, 'ready?');
    rooms.act(code, spy, { type: 'clue', word: 'zzzq', number: 1 });
    rooms.chat(code, ops[1]!, 'hmm');
    const chat = rooms.viewFor(code, ops[0]!)!.chat;
    expect(chat.map((l) => (l.kind === 'msg' ? l.text : l.event.type))).toEqual(['ready?', 'clueGiven', 'hmm']);

    // Everyone picks a bystander or rival: the turn ends and the chat empties.
    const game = rooms.rooms.get(code)!.game!;
    const miss = game.key.findIndex((k) => k === 'bystander');
    for (const op of ops) rooms.act(code, op, { type: 'pick', pick: miss });
    rooms.act(code, ops[0]!, { type: 'confirm' });
    expect(rooms.viewFor(code, ops[0]!)!.chat).toEqual([]);
  });

  it('silences the Spymaster during a game but not in the lobby', () => {
    const { rooms, code, ids } = room();
    expect(rooms.chat(code, ids[0]!, 'hi all')).toEqual({ ok: true });
    rooms.start(code, ids[0]!);
    expect(rooms.chat(code, ids[0]!, 'psst')).toEqual({ ok: false, error: 'SPYMASTER_SILENT' });
    expect(rooms.viewFor(code, ids[1]!)!.chat).toEqual([]);
  });

  it('limits length and rate', () => {
    const { rooms, code, ids, tick } = room();
    expect(rooms.chat(code, ids[1]!, '   ')).toEqual({ ok: false, error: 'MESSAGE_INVALID' });
    expect(rooms.chat(code, ids[1]!, 'x'.repeat(201))).toEqual({ ok: false, error: 'MESSAGE_INVALID' });
    for (let i = 0; i < 5; i++) expect(rooms.chat(code, ids[1]!, `m${i}`)).toEqual({ ok: true });
    expect(rooms.chat(code, ids[1]!, 'one more')).toEqual({ ok: false, error: 'TOO_FAST' });
    tick(5000);
    expect(rooms.chat(code, ids[1]!, 'later')).toEqual({ ok: true });
  });

  it('keeps only the last 10 lines', () => {
    const { rooms, code, ids, tick } = room();
    for (let i = 0; i < 15; i++) {
      rooms.chat(code, ids[i % 4]!, `m${i}`);
      tick(2000);
    }
    const chat = rooms.viewFor(code, ids[0]!)!.chat;
    expect(chat.map((l) => l.kind === 'msg' && l.text)).toEqual(['m5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14']);
  });
});
