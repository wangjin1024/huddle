import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type ErrorCode,
  type Joined,
  type RoomView,
  type ServerToClientEvents,
} from '@regicide/server/protocol';
import { tokens } from './storage';

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ path: SOCKET_PATH });

export type Reply<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode | 'TIMEOUT' };

/** The room this tab belongs to, re-joined automatically after a reconnect. */
let current: { code: string; token: string } | null = null;

function remember(result: Reply<Joined>) {
  if (result.ok) {
    current = { code: result.code, token: result.token };
    tokens.set(result.code, result.token);
  }
  return result;
}

async function call<T>(fn: () => Promise<Reply<T>>): Promise<Reply<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, error: 'TIMEOUT' };
  }
}

const timed = () => socket.timeout(8000);

export const api = {
  create: (name: string) => call(() => timed().emitWithAck('room:create', { name })).then(remember),
  join: (code: string, name?: string, token?: string) =>
    call(() => timed().emitWithAck('room:join', { code, name, token })).then(remember),
  leave: async () => {
    const result = await call(() => timed().emitWithAck('room:leave'));
    if (current) tokens.set(current.code, null);
    current = null;
    return result;
  },
  start: () => call(() => timed().emitWithAck('game:start')),
  act: (action: Parameters<ClientToServerEvents['game:action']>[0]) =>
    call(() => timed().emitWithAck('game:action', action)),
  playAgain: () => call(() => timed().emitWithAck('game:playAgain')),
};

socket.on('connect', () => {
  // A dropped connection loses the server-side seat binding; restore it.
  if (current) void api.join(current.code, undefined, current.token);
});

/** The latest room state pushed by the server, and whether the socket is connected. */
export function useRoom() {
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const onState = (v: RoomView) => setView(v);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  return { view, setView, connected };
}
