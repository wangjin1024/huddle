import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/rooms.js';

function room(...others: string[]) {
  const rooms = new RoomManager();
  const host = rooms.create('Lin');
  if (!host.ok) throw new Error(host.error);
  const ids = [host.playerId];
  for (const name of others) {
    const r = rooms.join(host.code, name);
    if (!r.ok) throw new Error(r.error);
    ids.push(r.playerId);
  }
  return { rooms, host, ids };
}

describe('RoomManager', () => {
  it('needs 2 players to start', () => {
    const { rooms, host } = room();
    expect(rooms.start(host.code, host.playerId)).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
    expect(rooms.join(host.code, 'Ben').ok).toBe(true);
    expect(rooms.start(host.code, host.playerId)).toEqual({ ok: true });
    const view = rooms.viewFor(host.code, host.playerId)!;
    expect(view.game?.players.map((p) => p.hand.length)).toEqual([5, 5]);
  });

  it('caps rooms at 5 players and refuses joins after the start', () => {
    const { rooms, host } = room('Ben', 'Chen', 'Dana', 'Eve');
    expect(rooms.join(host.code, 'Fay')).toEqual({ ok: false, error: 'ROOM_FULL' });
    expect(rooms.start(host.code, host.playerId).ok).toBe(true);
    expect(rooms.viewFor(host.code, host.playerId)!.game?.players[0]!.hand).toHaveLength(4);
  });

  it('only accepts well-formed actions', () => {
    const { rooms, host, ids } = room('Ben');
    rooms.start(host.code, host.playerId);
    const bad = [
      { type: 'play', cardId: 3 },
      { type: 'play', cardId: 'c'.repeat(20) },
      { type: 'discard' },
      { type: 'hint', to: ids[1], colour: 'P' },
      { type: 'hint', to: ids[1], number: 6 },
      { type: 'hint', to: ids[1], colour: 'R', number: 1 },
      { type: 'hint', to: ids[1] },
      { type: 'hint', to: 7, colour: 'R' },
      { type: 'cheat' },
      null,
    ];
    for (const action of bad) expect(rooms.act(host.code, host.playerId, action as never)).toEqual({ ok: false, error: 'BAD_REQUEST' });
  });

  it('plays a turn through the engine and logs it with its turn number', () => {
    const { rooms, host, ids } = room('Ben');
    rooms.start(host.code, host.playerId);
    const game = rooms.rooms.get(host.code)!.game!;
    const current = game.players[game.currentSeat]!;
    const other = game.players.find((p) => p !== current)!;
    const colour = other.hand[0]!.colour;
    expect(rooms.act(host.code, current.id, { type: 'hint', to: other.id, colour })).toEqual({ ok: true });
    const view = rooms.viewFor(host.code, ids[0]!)!;
    expect(view.log[0]).toMatchObject({ seq: 1, turn: 0, event: { type: 'hinted', to: other.id, colour } });
    expect(view.game!.hints).toBe(7);
  });

  it('keeps the seat of a player who leaves mid-game, and returns everyone to the lobby after it', () => {
    const { rooms, host, ids } = room('Ben');
    rooms.start(host.code, host.playerId);
    expect(rooms.leave(host.code, ids[1]!)).toEqual({ ok: true });
    expect(rooms.rooms.get(host.code)!.members).toHaveLength(2);
    expect(rooms.playAgain(host.code, host.playerId)).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });

    const r = rooms.rooms.get(host.code)!;
    r.game = { ...r.game!, phase: 'over', endReason: 'boom' };
    expect(rooms.playAgain(host.code, ids[1]!)).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.playAgain(host.code, host.playerId)).toEqual({ ok: true });
    expect(rooms.viewFor(host.code, host.playerId)).toMatchObject({ game: null, log: [] });
  });
});
