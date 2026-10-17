# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repo is for an online (browser-based, multiplayer) version of the cooperative deduction board game **Bomb Busters (炸弹克星)**. The chosen stack (PRD §11) is TypeScript everywhere: a shared pure rules engine, a Node + Socket.IO server, and a React + Vite client, deployed as one Node service. So far only `packages/engine` exists.

## Commands

npm workspaces, run from the repo root:

- `npm test`: run all tests (Vitest)
- `npx vitest run packages/engine/test/actions.test.ts -t "solo cut"`: run one file or one named test
- `npm run test:watch`: watch mode
- `npm run typecheck`: `tsc --noEmit` for the engine

## Engine architecture (`packages/engine`)

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

## Product scope

`docs/PRD.md` defines the MVP: online real-time rooms for a private group (no accounts, join by link), base rules only. The campaign, equipment and bots come later. Its §9 records how each rule the guide leaves unclear was decided. Some decisions deliberately differ from the guide, so check §9 before resolving a rule question yourself.

## Source of truth for game rules

`bomb_busters_game_guide.md` (written in Chinese) is the rules reference. Any game-logic implementation must match it; when the guide is ambiguous, ask the user rather than inventing a rule. Rule points that drive the design:

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
