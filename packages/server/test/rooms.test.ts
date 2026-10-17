import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/rooms.js';

function setup(n = 2) {
  const rooms = new RoomManager();
  const host = rooms.create('Lin');
  if (!host.ok) throw new Error(host.error);
  const others = ['Ben', 'Chen', 'Dana', 'Eve'].slice(0, n - 1).map((name) => {
    const r = rooms.join(host.code, name);
    if (!r.ok) throw new Error(r.error);
    return r;
  });
  return { rooms, code: host.code, host, others };
}

describe('RoomManager', () => {
  it('creates a room with a readable 4-letter code', () => {
    const { code, rooms, host } = setup(1);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}$/);
    expect(rooms.viewFor(code, host.playerId)).toMatchObject({ hostId: host.playerId, difficulty: 'simple', game: null });
  });

  it('validates names', () => {
    const { rooms, code } = setup(1);
    expect(rooms.create(' x ')).toEqual({ ok: false, error: 'NAME_INVALID' });
    expect(rooms.join(code, 'a'.repeat(17))).toEqual({ ok: false, error: 'NAME_INVALID' });
    expect(rooms.join(code, ' lin ')).toEqual({ ok: false, error: 'NAME_TAKEN' });
  });

  it('accepts codes in any case and rejects unknown rooms', () => {
    const { rooms, code } = setup(1);
    expect(rooms.join(code.toLowerCase(), 'Ben').ok).toBe(true);
    expect(rooms.join('ZZZZ', 'Ben')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('holds at most 5 players', () => {
    const { rooms, code } = setup(5);
    expect(rooms.join(code, 'Finn')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('only lets the host change difficulty and start, with at least 2 players', () => {
    const solo = setup(1);
    expect(solo.rooms.start(solo.code, solo.host.playerId)).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
    const { rooms, code, host, others } = setup(3);
    expect(rooms.setDifficulty(code, others[0]!.playerId, 'hard')).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.setDifficulty(code, host.playerId, 'extreme' as never)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(rooms.setDifficulty(code, host.playerId, 'hard').ok).toBe(true);
    expect(rooms.start(code, others[0]!.playerId)).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.start(code, host.playerId).ok).toBe(true);
    const view = rooms.viewFor(code, host.playerId)!;
    expect(view.game).toMatchObject({ difficulty: 'hard', phase: 'reveal', mistakesAllowed: 4 });
  });

  it('blocks new players once a game starts, but lets a seat rejoin with its token', () => {
    const { rooms, code, host, others } = setup(2);
    rooms.start(code, host.playerId);
    expect(rooms.join(code, 'Chen')).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
    expect(rooms.join(code, undefined, others[0]!.token)).toMatchObject({ ok: true, playerId: others[0]!.playerId });
    expect(rooms.join(code, 'Chen', 'not-a-token')).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });

  it('passes the host role on when the host leaves the lobby, and deletes empty rooms', () => {
    const { rooms, code, host, others } = setup(2);
    rooms.leave(code, host.playerId);
    expect(rooms.viewFor(code, others[0]!.playerId)!.hostId).toBe(others[0]!.playerId);
    expect(rooms.viewFor(code, others[0]!.playerId)!.players).toHaveLength(1);
    rooms.leave(code, others[0]!.playerId);
    expect(rooms.rooms.has(code)).toBe(false);
  });

  it('keeps the seat when someone leaves during a live game', () => {
    const { rooms, code, host, others } = setup(2);
    rooms.start(code, host.playerId);
    rooms.leave(code, others[0]!.playerId);
    expect(rooms.viewFor(code, host.playerId)!.players).toHaveLength(2);
  });

  it('rejects malformed actions before they reach the engine', () => {
    const { rooms, code, host } = setup(2);
    expect(rooms.act(code, host.playerId, { type: 'pass' })).toEqual({ ok: false, error: 'NO_GAME' });
    rooms.start(code, host.playerId);
    expect(rooms.act(code, host.playerId, { type: 'boom' } as never)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(rooms.act(code, host.playerId, null as never)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(rooms.act(code, host.playerId, { type: 'reveal', wireId: 7 } as never)).toEqual({
      ok: false,
      error: 'BAD_REQUEST',
    });
  });

  it('logs setup reveals without their value, and returns to the lobby on play again', () => {
    const { rooms, code, host, others } = setup(2);
    rooms.start(code, host.playerId);
    const room = rooms.rooms.get(code)!;
    for (const id of [host.playerId, others[0]!.playerId]) {
      const blue = room.game!.players.find((p) => p.id === id)!.rack.find((w) => w.color === 'blue')!;
      expect(rooms.act(code, id, { type: 'reveal', wireId: blue.id }).ok).toBe(true);
    }
    expect(room.log.map((e) => e.event)).toEqual([
      { type: 'revealed', player: host.playerId },
      { type: 'revealed', player: others[0]!.playerId },
    ]);
    expect(rooms.playAgain(code, host.playerId)).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
    room.game!.phase = 'won';
    rooms.leave(code, others[0]!.playerId);
    expect(rooms.viewFor(code, host.playerId)!.players).toHaveLength(2);
    expect(rooms.playAgain(code, host.playerId).ok).toBe(true);
    expect(rooms.viewFor(code, host.playerId)).toMatchObject({ game: null, log: [] });
    expect(rooms.viewFor(code, host.playerId)!.players).toHaveLength(1);
  });
});
