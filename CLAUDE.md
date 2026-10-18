# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repo is **Huddle** (github.com/wangjin1024/huddle, served at huddle.kinddot.net), a site for cooperative team games only: no player-vs-player competition. It hosts three online, browser-based multiplayer games:

- **Bomb Busters (炸弹克星)**, a cooperative deduction board game: `games/bomb-busters/*` (`@bomb-busters/*`).
- **Regicide (弑君者)**, a cooperative card game played with a standard deck: `games/regicide/*` (`@regicide/*`).
- **Codenames (代号)**, the cooperative (one team vs. the board) mode of the word game: `games/codenames/*` (`@codenames/*`).

Each game has its own folder with the same three npm workspaces: `engine` (pure rules), `server` (Node + Socket.IO) and `client` (React + Vite), all TypeScript. A new game gets its own `games/<name>/` folder in the same shape. `host/` (`@huddle/host`) is the one Node service that runs them all in production.

## Commands

Run from the repo root:

- `npm run dev`: the host (tsx watch, :3001) plus each game's Vite: Bomb Busters on :5173, Regicide on :5174, Codenames on :5175. Each Vite forwards its game's socket path to the host. Open http://localhost:5173/boom-buster/, http://localhost:5174/regicide/ or http://localhost:5175/codenames/.
- `npm run build && npm start`, or `./run.sh` (adds `npm install` and PM2 via `ecosystem.config.cjs`): production on `$HOST:$PORT` (default `0.0.0.0:3001`; read from `.env`).
- `npm test`: all tests (Vitest): every game's engine and server, plus the host
- `npx vitest run games/bomb-busters/engine/test/actions.test.ts -t "solo cut"`: one file or one named test
- `npm run typecheck`: `tsc --noEmit` for the host and every game package

No package has a build step for its TypeScript. Workspace packages import each other's `.ts` source directly: tsx runs the host (and through it each game server), and Vite bundles each client.

## URLs and hosting

Production is `huddle.kinddot.net`, with Caddy reverse-proxying everything to this one Node process:
- `/`: `hub/index.html`, the static "Huddle" game picker (one card per game). Not part of the React build. Its EN/中文 text swaps via `data-i18n` keys and a small inline script. The language choice is saved under `huddle:lang`, the same key the game's `i18n.tsx` uses, so it carries over between them.
- `/boom-buster/`: Bomb Busters. Rooms are at `/boom-buster/r/CODE`, and the socket is at `/boom-buster/socket.io`.
- `/regicide/`: Regicide, laid out the same way (`/regicide/r/CODE`, `/regicide/socket.io`).
- `/codenames/`: Codenames, the same again (`/codenames/r/CODE`, `/codenames/socket.io`).

`host/src/app.ts` owns the one HTTP server: it serves the hub and each game's `client/dist` under the game's base path, and calls each game server's `attach(http)` to add its Socket.IO (with `destroyUpgrade: false`, so the games don't drop each other's websocket upgrades). Adding a game means adding it to `GAME_PATHS` and `createHost` there, to `host/src/main.ts`, and to the root `dev`/`build` scripts.

Each game's base path is defined twice and both must match: `BASE_PATH` in `games/<game>/server/src/protocol.ts`, and `base` in `games/<game>/client/vite.config.ts`. Client code builds URLs from `src/paths.ts` (which uses `import.meta.env.BASE_URL`); never hard-code `/r/...`.

The sections below describe Bomb Busters; Regicide and Codenames follow the same structure and conventions (see their own sections after them).

## Engine architecture (`games/bomb-busters/engine`)

Pure, no I/O. Packages import it straight from TypeScript source (`exports: ./src/index.ts`, no build step).

- `setup.ts`: `createGame` deals the deck for a difficulty (rng is injectable). `createGameFromHands` builds a state from explicit hands; tests use it.
- `rules.ts`: rule predicates (`canSoloCut`, `legalActions`, win check). Both the server and the client use these.
- `actions.ts`: `applyAction(state, action)` returns `{ ok, state, events }` or `{ ok: false, error }`. It never mutates its input. `events` feed the action log.
- `view.ts`: `viewFor(state, playerId)` is the **only** thing the server should send a client. It hides other players' uncut wires (no color or value), and keeps setup reveals hidden until everyone has chosen.

Engine conventions:
- Wire ids are position-based (`<seat>-<index>`), so they never leak a wire's value. Keep it that way.
- A wire's `value` is its sort key: blue integer, yellow X.1, red X.5.
- Markers always show a wire's real value, so a wire only needs a `marked` flag.
- A dual cut includes `ownWireId` up front. It's required only when the player holds more than one matching wire.
- Test helpers live in `test/helpers.ts`. `playing({...hands})` gives a game that is already past the setup reveal.

## Server (`games/bomb-busters/server`)

- `protocol.ts`: the socket event types and `RoomView`, shared with the client. The client imports it **as types only**, plus constants. Keep it free of Node imports.
- `rooms.ts`: `RoomManager` holds the in-memory rooms and the join/leave/start rules, with no sockets. `toAction` copies only known fields from client input before anything reaches the engine.
- `server.ts`: Socket.IO wiring (`attach(http)`). After every change it calls `broadcast(code)`, which sends each socket its **own** `RoomView`. Never `io.to(room).emit` game state.
- Identity: each seat has a secret `token`, returned only in the join/create reply, never in broadcasts. Rejoining with it restores the seat, so a refresh or reconnect keeps your place. A disconnected player pauses the game; nobody can skip their turn.
- The action log is broadcast to everyone, so it holds only public events (`PublicEvent`). Setup reveals are logged without their value.
- `test/socket.test.ts` runs a real server and checks that no raw payload leaks hidden wires or tokens.

## Client (`games/bomb-busters/client`)

- `net.ts`: a single socket plus a typed `api` built on `emitWithAck`. `useRoom()` holds the latest `RoomView`. After any reconnect it re-joins with the stored token.
- `i18n.tsx`: EN/中文 dictionaries. `zh` is typed `Record<MessageKey, string>`, so a missing translation is a type error. All UI text goes through `t()`.
- Routing is just `/` and `/r/CODE` (`App.tsx`). The screens are `Home`, `Lobby`, `Game` (with a `Result` overlay), all in `components/`.
- Legal moves come from `view.game.legal`, which the server computes. The client doesn't re-implement rules.
- Visual design reference: the "Bomb Busters UI" canvas artifact. Colours live as CSS variables in `styles.css`.

## Regicide (`games/regicide/*`)

Product and rules decisions: `docs/regicide/PRD.md`. Rules reference: `game_rules/regicide_rules.md` (Chinese). The guide is unclear in places; PRD §9 records how each point was decided (e.g. enemy cards in hand are worth 10/15/20, the Jester cancels immunity for the rest of that fight, its player picks who goes next, powers resolve ♥ ♦ ♠ ♣). Check §9 before resolving a rule question, and ask the user about anything it doesn't cover.

- Engine: `cards.ts` (card ids, values, sorting), `setup.ts` (`createGame`, `createGameFromHands`, `PLAYER_SETUP` by player count), `rules.ts` (`playKind`, `previewPlay`, enemy health/attack), `actions.ts` (`applyAction(state, action, rng)`; the rng shuffles the discard pile for ♥), `view.ts` (`viewFor`).
- Card ids are the cards themselves (`H7`, `SA`, `CK`, Jesters `X1`/`X2`). That's safe because hidden cards are never sent: `viewFor` turns other hands into `handCount` and the tavern deck into `tavernCount`. Keep it that way.
- `previewPlay` is the single source of play resolution: the engine applies it, and the client shows it as the damage preview before a play.
- Phases: `play` → `discard` (enemy survived and attacks) or `chooseNext` (after a Jester) → next turn. `view.legal` says what the viewer may do now.
- Every engine event except `turnStarted` is public, so the room log stores them as-is. Diamonds draws log counts per player, never the cards.
- Test helpers: `games/regicide/engine/test/helpers.ts` (`game({...hands}, { tavern, castle, discard })`, `play`, `discard`, `act`).
- Visual design reference: the "Regicide UI" canvas artifact (https://claude.ai/artifact/294Kd5UyiU1TzjcLvsc3nn).

## Codenames (`games/codenames/*`)

Product and rules decisions: `docs/codenames/PRD.md` (§9 records each decision). Rules reference: `game_rules/codenames_game_rules.md` (Chinese). Only the guide's cooperative mode is built; the red-vs-blue mode is out of scope for Huddle.

- Engine: `words/en.ts`, `words/zh.ts` (400 built-in words each; a test checks count, uniqueness and that no two overlap), `words.ts` (`overlaps`, `checkClue`, `checkPlayerWord`), `setup.ts` (`createGame`, `createGameFromBoard`, `drawWords`), `rules.ts` (`captainOf`, `agreedPick`), `actions.ts` (`applyAction(state, action)`: `clue`, `pick`, `confirm`), `view.ts` (`viewFor(state, playerId, connected)`).
- Hidden information is the key. `viewFor` sends `key` only to the Spymaster (and to everyone once the game is over); Operatives get `revealed[i]` for revealed cards only. Card ids are board positions 0–24.
- Agreement: every connected Operative must pick the same word (or `stop`), then the clue's captain confirms. Captaincy rotates per clue; `confirm` takes the connected ids, so the engine stays pure while offline players don't block. Going offline clears that player's pick (`dropPick`).
- Room-level features live in `server/src/rooms.ts`, not the engine: the Spymaster choice, board language, player-added words (Chinese rooms, ≤3 each, always on the board, hidden from non-hosts until the deal, cleared each game), and the chat. The chat keeps only the current round, and at most its last 10 lines (`CHAT_KEEP`): it is emptied on `turnEnded`, on start and on Play again. The Spymaster can't post while a game is live.
- Test helpers: `games/codenames/engine/test/helpers.ts` (`game()`, `clue`, `pick`, `confirm`, `agree`).
- Visual design reference: the "Codenames UI" canvas artifact (https://claude.ai/artifact/Ku53c53xAUGTmoJku26gYV).

## Product scope

`docs/bomb-busters/PRD.md` defines the Bomb Busters MVP: online real-time rooms for a private group (no accounts, join by link), base rules only. The campaign, equipment and bots come later. Its §9 records how each rule the guide leaves unclear was decided. Some decisions deliberately differ from the guide, so check §9 before resolving a rule question yourself.

## Source of truth for game rules (Bomb Busters)

`game_rules/bomb_busters_game_guide.md` (written in Chinese) is the rules reference. Any game-logic implementation must match it; when the guide is ambiguous, ask the user rather than inventing a rule. Rule points that drive the design:

- **Wires**: blue 1–12 (four of each, 48 total) are safe and must all be cut to win; red wires (💣) end the game immediately if cut. Medium and hard difficulty add 2 yellow wires (difficulty table in PRD §5.1): they have decimal values for sorting, are cut by declaring "yellow", and must be cut to win.
- **Racks are always sorted ascending** left to right. Deduction depends on this, so rack order is a game invariant, not a display preference.
- **Turn = exactly one action**:
  - *Dual cut*: point at a teammate's hidden wire and name a value you **hold yourself**. Correct → both wires are cut. Wrong → a marker showing that wire's **real** value is placed next to it (a deliberate change from the guide's "guessed value" wording) and the detonator advances one step. Red → instant loss.
  - *Solo cut*: cut your own wires of a value when you hold all 4 of them, or hold the only 2 left after the other 2 were cut.
- **Loss**: a red wire is cut, or the detonator reaches its end. **Win**: all blue wires are cut.
- **Communication limits**: players may not reveal specific values, counts, or positions in their hands. Any in-game chat feature must take this into account.
- **Campaign**: 66 missions that add rule variants, equipment, and yellow wires. Mission rules should plug in as data/config on top of the base rules instead of being hard-coded into the core turn logic.

## Implementation constraint

This is a hidden-information game. Each client must only receive its own rack plus public state (cut wires, markers, detonator position). Keep the authoritative game state and move validation on the server.
