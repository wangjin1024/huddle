import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/rooms.js';

function room() {
  const rooms = new RoomManager();
  const host = rooms.create('Lin');
  if (!host.ok) throw new Error(host.error);
  return { rooms, host };
}

describe('RoomManager', () => {
  it('lets the host start a solo game', () => {
    const { rooms, host } = room();
    expect(rooms.start(host.code, host.playerId)).toEqual({ ok: true });
    const view = rooms.viewFor(host.code, host.playerId)!;
    expect(view.game?.hand).toHaveLength(8);
    expect(view.game?.jesters).toBe(0);
  });

  it('caps rooms at 4 players and refuses joins after the start', () => {
    const { rooms, host } = room();
    for (const name of ['Ben', 'Chen', 'Dana']) expect(rooms.join(host.code, name).ok).toBe(true);
    expect(rooms.join(host.code, 'Eve')).toEqual({ ok: false, error: 'ROOM_FULL' });
    expect(rooms.start(host.code, host.playerId).ok).toBe(true);
    expect(rooms.viewFor(host.code, host.playerId)!.game?.hand).toHaveLength(5);
  });

  it('only accepts well-formed actions', () => {
    const { rooms, host } = room();
    rooms.start(host.code, host.playerId);
    const bad = [
      { type: 'play', cards: 'H2' },
      { type: 'play', cards: ['H11'] },
      { type: 'play', cards: Array(9).fill('H2') },
      { type: 'discard', cards: [{}] },
      { type: 'chooseNext', next: 4 },
      { type: 'cheat' },
      null,
    ];
    for (const action of bad) expect(rooms.act(host.code, host.playerId, action as never)).toEqual({ ok: false, error: 'BAD_REQUEST' });
  });

  it('plays a card through the engine and logs public events', () => {
    const { rooms, host } = room();
    rooms.start(host.code, host.playerId);
    const card = rooms.viewFor(host.code, host.playerId)!.game!.hand[0]!;
    expect(rooms.act(host.code, host.playerId, { type: 'play', cards: [card] })).toEqual({ ok: true });
    const view = rooms.viewFor(host.code, host.playerId)!;
    expect(view.log[0]?.event).toMatchObject({ type: 'played', cards: [card] });
    expect(view.log.some((e) => (e.event.type as string) === 'turnStarted')).toBe(false);
  });
});
