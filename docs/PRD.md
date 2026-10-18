# Bomb Busters Online — Product Requirements Document (MVP)

Status: Draft · Owner: wangjin1024 · Last updated: 2026-10-17
Rules reference: [`game_rules/bomb_busters_game_guide.md`](../game_rules/bomb_busters_game_guide.md)

## 1. Summary

A browser-based, real-time, online version of the cooperative deduction board game **Bomb Busters (炸弹克星)** for a private group of 2–5 friends. One player creates a room and shares a link, everyone joins from their own device, and the team works together to cut every blue wire before the bomb goes off.

## 2. Goals and non-goals

### Goals (MVP)
- Play a complete base-rules game online with 2–5 players, each on their own device.
- Enforce every rule automatically: sorted racks, legal actions, detonator, win/loss.
- Keep hidden information hidden: no client can see another player's wires before they are revealed.
- Make deduction easy by showing all public information clearly (cut wires, markers, remaining count per value).
- Zero-friction joining: no accounts, just a room link and a nickname.

### Non-goals (for now)
- The 66-mission campaign, equipment/item cards, mission-specific rules.
- AI/bot players.
- Accounts, matchmaking, public lobbies, rankings.
- Native mobile apps (but the web UI must work on phones).
- Built-in voice chat (players use their own call app).

## 3. Users

A group of friends or family who already know each other and are usually on a voice call. Some have played the physical game and some have not, so the game must teach the rules while it is being played (for example, by showing why an action is not allowed).

## 4. User stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | host | create a room and get a shareable link | friends can join quickly |
| U2 | player | join with just a nickname | I don't need an account |
| U3 | host | start the game once 2–5 players are in | we can begin |
| U4 | player | see my own rack sorted, and everyone else's as face-down wires | I can reason about hidden wires |
| U5 | player on my turn | pick a teammate's hidden wire and name a value I hold | I can try a dual cut |
| U6 | player on my turn | solo cut when I qualify | I can cut safely without risk |
| U7 | player | see only the actions that are legal right now | I can't make an illegal move by mistake |
| U8 | player | see all cut wires, markers, detonator position and a log of actions | I have everything I need to deduce |
| U9 | player | rejoin after a refresh or disconnect | one dropped connection doesn't ruin the game |
| U10 | team | see a clear win/loss screen and play again in the same room | we can keep playing |

## 5. Game rules to implement (MVP)

These are taken from the rules guide. Items marked **[OQ-n]** depend on open questions in §9.

### 5.1 Components
- **Blue wires**: values 1–12, 4 copies each (48 total).
- **Yellow wires**: 0 or 2 per game, depending on difficulty. Each has a decimal value (for example 3.1) that sets where it sorts in a rack. They are safe, and they must be cut to win.
- **Red wires**: 1–2 per game, depending on difficulty. Each has a hidden half-value (1.5–11.5, chosen at random per game) that sets where it sorts in a rack.
- **Difficulty** (the host chooses it in the lobby):

  | Level | Red | Yellow |
  |---|---|---|
  | Simple | 1 | 0 |
  | Medium | 1 | 2 |
  | Hard | 2 | 2 |
- **Detonator**: counts wrong guesses. The team can make (number of players + 1) wrong guesses; the next one explodes the bomb. For example, 4 players can make 5, and the 6th explodes.
- **Markers**: placed next to a wire after a wrong guess.

### 5.2 Setup
1. Shuffle all 48 blue wires together with the yellow and red wires for the chosen difficulty (see §5.1), and deal them as evenly as possible.
2. Each rack is automatically sorted in ascending order, left to right, by wire value (blue integers, yellow X.1, red X.5).
3. Special wires announced: everyone is shown the values of the red and yellow wires in this game (e.g. bombs 4.5 and 8.5, yellow 2.1 and 7.1), but not who holds them. The list stays visible all game.
4. Initial info reveal: all players at the same time choose one of their own **blue** wires and put a marker showing its value. The wire stays uncut. Play starts once everyone has chosen.
5. Choose the first player at random. Play then goes clockwise (in join order).

### 5.3 Turn: exactly one action
**Dual cut**
- Requirement: the active player holds at least one uncut wire of value V. V is either a number 1–12 or **"yellow"** (which requires holding an uncut yellow wire).
- Target: an uncut wire on another player's rack.
- Correct (the target is V, or is a yellow wire when V is "yellow"): the target is revealed and cut, and one of the active player's matching wires is also cut. If they hold more than one, they choose which (the UI asks only when there is a real choice).
- Wrong (the target is a different blue or yellow): the target stays uncut, a marker showing its **real value** (or "yellow") is placed next to it, and the detonator moves forward 1 step.
- Red: the bomb explodes and the team loses.

**Solo cut**
- Allowed for value V if the active player holds all 4 uncut V wires, **or** 2 V wires are already cut and the active player holds the other 2.
- Effect: those wires are revealed and cut. The detonator does not move.
- Solo cut is always optional. A qualifying player may dual cut instead.
- **Yellow solo cut**: allowed only when **all remaining uncut yellow wires** are in the active player's hand **and** either every blue wire in the game is already cut (the yellows are the final cut), **or** the yellows are the only wires that player has left to cut (their blue wires are all cut; red wires can't be cut). With 2 yellows this means holding both. (Yellow wires are always cut in pairs, so a lone leftover yellow can't happen.)

**No legal action**
- If the active player can neither dual cut nor solo cut, they see a "No legal moves" notice and tap to pass. The pass is recorded in the action log.

### 5.4 End of game
- **Win**: all 48 blue wires and any yellow wires in play are cut.
- **Loss**: a red wire is cut, or the detonator reaches its final step.

### 5.5 Communication
The rules forbid stating values, counts or positions. MVP has **no in-game text chat** (players talk on their own call), so the app does not try to enforce this. Optional later: emoji/quick-phrase reactions that cannot carry hand information.

## 6. Functional requirements

### 6.1 Rooms and lobby
- FR1: Create a room → get a short room code and link.
- FR2: Join by link or code with a nickname (2–16 characters, unique within the room).
- FR3: The lobby shows the player list and seat order. The host picks the difficulty (simple / medium / hard) and can start the game when 2–5 players are present.
- FR4: A game can't be joined after it starts (spectating is out of scope).
- FR5: "Play again" restarts with the same players and seats.

### 6.2 Game screen
- FR6: My rack is shown face-up and sorted, with cut wires visibly marked.
- FR7: Teammates' racks are shown face-down in sorted order, with revealed wires and markers visible.
- FR8: Public panel: detonator (current / max), cut-wire tally per value (for example "5: 2/4 cut"), and the current player.
- FR9: Action log: who did what, the result, and the detonator change.
- FR10: On my turn: tap a teammate's wire, then tap one of **my own** wires. My wire is highlighted red, its value is the guess, and it is the wire of mine that gets cut on a success. Red wires can't be selected. If the selected wire qualifies for a solo cut, a solo-cut button appears for it.
- FR11: A red Confirm button names the cut ("Confirm: cut Player B's #3 as 5") and must be pressed to send it.
- FR12: Show reveals, explosions and wins with clear animations or feedback.

### 6.3 Connection
- FR13: Rejoining from the same browser restores your seat (via a session token).
- FR14: If the active player disconnects, the game pauses and shows "Waiting for <name> to reconnect". There is no timeout or skip.

## 7. Non-functional requirements

- **Server-authoritative**: the server holds the full state and validates every action. Each client receives only its own rack plus public state. Hidden values never go to other clients, not even in the network payload.
- **Deterministic engine**: rules live in a pure, UI-independent engine (`state + action → new state + events`) that can be unit-tested and later extended with mission rules as data/config.
- **Latency**: an action's result reaches all players in under 500 ms under normal conditions.
- **Devices**: latest Chrome, Safari and Firefox, desktop and mobile (phone width ≥ 360 px).
- **Language**: the MVP ships with both Chinese and English and a language switch. All UI text goes through i18n.
- **Persistence**: rooms can live in memory. Losing them on a server restart is acceptable for MVP.

## 8. Success criteria

- A group of 4 can finish a full game without help and without the app ever allowing an illegal move.
- Engine unit tests cover every rule in §5, including edge cases (solo-cut conditions, a red-wire cut, the detonator's last step, the last blue wire).
- No hidden wire value shows up in any other player's network traffic (verified by a test).

## 9. Rule decisions and open questions

Rules the guide leaves unclear, and how each was settled. All are decided.

| ID | Question | Decision / proposed default |
|---|---|---|
| ~~OQ-1~~ | ~~Wire counts at setup~~ | **Decided:** all 48 blue plus the difficulty's yellow and red wires (§5.1), dealt as evenly as possible. |
| ~~OQ-2~~ | ~~Red wire position in rack~~ | **Decided:** red wires have half-values (X.5) and sort between blue wires. |
| ~~OQ-3~~ | ~~Detonator size~~ | **Decided:** players + 1 wrong guesses allowed; the next wrong guess explodes the bomb. |
| ~~OQ-4~~ | ~~Which own wire is cut~~ | **Decided:** the player chooses. |
| ~~OQ-5~~ | ~~Initial info reveal~~ | **Decided:** each player marks one of their own blue wires with its value at setup. |
| ~~OQ-6~~ | ~~Wrong-guess marker~~ | **Decided:** the marker shows the wire's real value. This differs from the guide on purpose. |
| ~~OQ-7~~ | ~~No legal action~~ | **Decided:** the player sees a notice and taps to pass. |
| ~~OQ-8~~ | ~~Disconnect handling~~ | **Decided:** no skip; the game waits for the player to reconnect. |
| ~~OQ-9~~ | ~~UI language~~ | **Decided:** Chinese and English from day one. |
| ~~OQ-10~~ | ~~Solo cut optional?~~ | **Decided:** optional. |
| ~~OQ-11~~ | ~~Difficulty levels~~ | **Decided:** simple = 1 red; medium = 1 red + 2 yellow; hard = 2 red + 2 yellow. |
| ~~OQ-12~~ | ~~Yellow-wire rules~~ | **Decided:** adopted as written (decimal values for sorting, cut by declaring "yellow", required to win). They don't have to match the physical game. |
| ~~OQ-13~~ | ~~Yellow solo cut~~ | **Decided:** only when you hold both, and only after all blue wires are cut, or when the yellows are your last wires to cut. |

## 10. Roadmap after MVP

1. **Mission framework**: missions as data (setup changes, detonator size, rule modifiers), then the early campaign missions.
2. Equipment cards.
3. Saving campaign progress for a group.
4. AI teammates to fill empty seats.
5. Quick-phrase reactions that follow the communication rules.

## 11. Technical decisions

| Area | Decision |
|---|---|
| Language | TypeScript everywhere (client, server, shared rules engine) |
| Frontend | React + Vite |
| Real-time | Node.js server + Socket.IO (rooms, auto-reconnect) |
| Hosting | One Node service serves the built frontend and Socket.IO (Render / Railway / Fly.io). Rooms live in memory, single instance. |

Proposed repo layout (one repo, npm workspaces):
- `packages/engine`: pure rules engine (`state + action → new state + events`), plus a function that builds each player's view, with private wires hidden. No I/O. Unit-tested with Vitest.
- `packages/server`: Node + Socket.IO. Handles rooms, sessions and reconnects, and runs the engine. Sends each player only their own view.
- `packages/client`: React + Vite UI, with i18n for Chinese and English. Imports the engine to show which moves are legal. The server still has the final say.
