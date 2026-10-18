# Regicide Online — Product Requirements Document (MVP)

Status: Draft · Owner: wangjin1024 · Last updated: 2026-10-18
Rules reference: [`game_rules/regicide_rules.md`](../../game_rules/regicide_rules.md)
Visual design: the "Regicide UI" canvas artifact (https://claude.ai/artifact/294Kd5UyiU1TzjcLvsc3nn)

## 1. Summary

A browser-based, real-time, online version of the cooperative card game **Regicide (弑君者)**, the second game on Huddle (huddle.kinddot.net). 1–4 players share a room link, each plays from their own device, and the team works through a castle of 12 enemies (4 Jacks, 4 Queens, 4 Kings) using a standard deck. Every card does damage, and its suit adds a power: heal the deck, draw cards, double damage, or shield against the enemy's attack. The team wins by defeating the last King.

It reuses everything Bomb Busters already proved: no accounts, join by link, one secret seat token per player, server-authoritative rules in a pure engine, EN/中文, and the same dark Huddle look.

## 2. Goals and non-goals

### Goals (MVP)
- Play a complete base-rules game online with 1–4 players, each on their own device.
- Enforce every rule automatically: legal plays and combos, suit powers, immunity, Jester, taking damage, win/loss.
- Keep hands hidden: no client can see another player's cards, not even in the network payload.
- Make the arithmetic effortless: before confirming, show exactly how much damage a play deals, what each suit does, and whether it kills the enemy (and whether it's an exact kill).
- Zero-friction joining: no accounts, just a room link and a nickname.
- Share hosting with Bomb Busters: one Node service, one domain, game picked from the Huddle hub.

### Non-goals (for now)
- Official solo-mode Jester powers (flip-hand). Solo is played with the base rules from the guide.
- Victory tiers (gold/silver/bronze by Jesters used), score tracking, expansions.
- AI/bot players; spectators.
- In-game text chat (players use their own call).
- Accounts, matchmaking, public lobbies.

## 3. Users

The same private groups who play Bomb Busters: friends or family on a voice call. Regicide is simpler to learn but heavy on mental arithmetic and on planning around one another's hands, so the UI should do the math and make the enemy's state impossible to misread.

## 4. User stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | host | create a room and get a shareable link | friends can join quickly |
| U2 | player | join with just a nickname | I don't need an account |
| U3 | host | start once 1–4 players are in | we can begin (solo too) |
| U4 | player | always see the current enemy's suit, HP, attack and immunity | I know what I'm up against |
| U5 | player on my turn | select one or more cards and see a damage preview before confirming | I don't miscount |
| U6 | player | be told why a card selection isn't a legal play | I learn the combo rules while playing |
| U7 | player hit by the enemy | pick cards to discard and see the running total vs. the attack | I survive with the cards I want to keep |
| U8 | player | see each teammate's hand size, the deck, the discard pile and the remaining castle | I can plan around everyone |
| U9 | player | see a log of every play, suit power, kill and discard | I can follow what happened |
| U10 | player | rejoin after a refresh or disconnect | one dropped connection doesn't end the game |
| U11 | team | see a clear win/loss screen and play again in the same room | we can keep playing |

## 5. Game rules to implement (MVP)

Taken from the rules guide. Items marked **[OQ-n]** were unclear in the guide; §9 records how each was decided.

### 5.1 Components
- **Castle deck** (enemies): the 12 face cards, stacked top to bottom as the 4 Jacks (shuffled), then the 4 Queens (shuffled), then the 4 Kings (shuffled). The top card is the current enemy, face up.

  | Enemy | HP | Attack |
  |---|---|---|
  | Jack | 20 | 10 |
  | Queen | 30 | 15 |
  | King | 40 | 20 |
- **Tavern deck** (player deck): A–10 in all four suits (40 cards), plus Jesters by player count: 1–2 players 0, 3 players 1, 4 players 2. Shuffled.
- **Card value**: A = 1, 2–10 face value, Jester = 0. An enemy card that joins the tavern deck after an exact kill is worth **[OQ-1]**.
- **Hand size** (max) by player count: 1 → 8, 2 → 7, 3 → 6, 4 → 5. Everyone is dealt to max at the start.
- **Discard pile**: face up and public.

### 5.2 Setup
1. Build the castle and reveal the top Jack.
2. Build and shuffle the tavern deck, then deal each player up to the hand size.
3. A random player goes first. Play then goes clockwise (seat order).

### 5.3 Turn: four steps

**Step 1: Play cards.** The active player must play exactly one of:
- a **single card** (A–10, or an enemy card in hand);
- a **set** of 2–4 cards of the **same rank** whose total is **≤ 10** (2-2, 2-2-2, 2-2-2-2, 3-3, 3-3-3, 4-4, 5-5);
- an **Ace companion**: one Ace together with one other card (**[OQ-2]** for which cards an Ace can join);
- a **Jester**, alone (see 5.5).

If the active player's hand is empty at the start of their turn, the team loses. There is no yield/pass (**[OQ-3]**).

**Step 2: Suit powers.** Each distinct suit among the played cards activates once, using the play's **base value** (the sum of card values, before Clubs doubling). A suit matching the current enemy's suit does nothing (**immunity**), unless a Jester cancelled it (**[OQ-4]**). Powers resolve in a fixed order: Hearts, then Diamonds, then Spades, then Clubs (**[OQ-5]**).
- ♥ **Hearts (heal)**: shuffle the discard pile, take *base value* cards (or all, if fewer), and put them face down under the tavern deck.
- ♦ **Diamonds (draw)**: draw up to *base value* cards from the tavern deck, one at a time, starting with the active player and going clockwise, skipping players already at max hand size. Stop when the count is reached, the deck is empty, or every hand is full.
- ♠ **Spades (shield)**: reduce the current enemy's attack by *base value* for the rest of the fight with it. Shields add up across turns; attack can't go below 0.
- ♣ **Clubs (double)**: damage dealt is *base value* × 2.

**Step 3: Deal damage.** Subtract damage from the enemy's HP.
- **HP > 0**: go to step 4.
- **HP = 0 (exact kill)**: the enemy card goes face down **on top** of the tavern deck. Then step 3 end.
- **HP < 0 (overkill)**: the enemy card goes to the discard pile. Then step 3 end.
- *Step 3 end* (enemy defeated): all cards played against this enemy go to the discard pile (**[OQ-6]**), the next castle card is revealed, step 4 is skipped, and the turn passes to the **next player** (per the guide; the official rules let the same player go again).

**Step 4: Suffer damage.** If the enemy survived, it attacks the active player for its current attack (base attack minus shields). If that is above 0, the player chooses cards from their hand whose **total value ≥ the attack** and discards them. If their whole hand totals less than the attack, the team loses immediately. Then the turn passes clockwise.

### 5.4 End of game
- **Win**: the last King is defeated.
- **Loss**: a player can't discard enough to cover an attack, or starts a turn with an empty hand.

### 5.5 Jester
- Played alone in step 1, from hand. It deals no damage and has no suit.
- Cancels the current enemy's immunity (**[OQ-4]** for how long).
- Skips step 4: the enemy doesn't attack this turn.
- The Jester goes to the played-cards area like any card and is discarded with them.
- Next, a player chooses who takes the next turn (**[OQ-7]**); any seat may be chosen, including the one who played the Jester.

### 5.6 Communication
The guide sets no limits on talk. The official rules ask players not to reveal the exact contents of their hand. MVP has no in-game chat, so the app doesn't police it. Hand **sizes** are public, as they are at a real table.

## 6. Functional requirements

### 6.1 Hub and rooms
- FR1: The Huddle hub (`/`) gets a second card, "Regicide 弑君者", linking to `/regicide/`.
- FR2: Create a room → short room code and link (`/regicide/r/CODE`).
- FR3: Join by link or code with a nickname (2–16 characters, unique in the room).
- FR4: The lobby shows seats 1–4, and a setup summary for the current player count (hand size, Jesters). There are no difficulty levels. The host starts with 1–4 players.
- FR5: A game can't be joined after it starts. "Play again" restarts with the same seats.

### 6.2 Game screen
- FR6: **Enemy panel**, the visual centre: a large card with its rank and suit, an HP bar (current/max), the attack with any shield shown separately ("Attack 10 − 6 shield = 4"), and an immunity badge naming the blocked power ("Immune to ♥ heal"), struck through once a Jester cancels it.
- FR7: **Castle track**: 12 slots in J/Q/K groups, showing defeated (and whether exact), current, and remaining. The order of the remaining enemies within each rank stays hidden.
- FR8: **Table counts**: tavern deck size, discard size (tap to see the discard pile, sorted by suit), and the cards played against the current enemy.
- FR9: **Teammates**: name, hand size as card backs with "n / max", connection state and the turn marker. Never their cards.
- FR10: **My hand**: face-up cards sorted by value, then suit (so sets sit together), Jesters last. During step 1 I tap cards to select them; the selection shows a **damage preview** ("7♣ + A♥ = 8 → 16 damage, heal 8; enemy 20 → 4") and the confirm button names the play. An illegal selection disables confirm and says why ("Sets must total 10 or less").
- FR11: Exact-kill feedback: when the preview lands exactly on 0 it says "Exact kill: the Jack joins your deck".
- FR12: **Step 4 (taking damage)**: the hand switches to discard mode: a progress bar of selected value vs. attack, and a "Discard n cards" button enabled once covered. If the hand can't cover the attack, the screen shows the loss instead.
- FR13: **Jester**: after a Jester, the chooser sees a seat picker ("Who goes next?"); everyone else sees "Waiting for <name> to choose".
- FR14: **Action log**: plays with damage, each suit power and its effect (cards healed, how many cards each player drew, shield added), kills (exact/overkill), and the cards discarded to take damage (they land face up in the discard pile anyway).
- FR15: **Result overlay**: win/loss, enemies defeated, exact kills, Jesters used, turns, and Play again.

### 6.3 Connection
- FR16: Rejoining from the same browser restores your seat (seat token, as in Bomb Busters).
- FR17: If the player who must act (play, discard or choose) disconnects, the game pauses until they're back. No timeout or skip.

## 7. Non-functional requirements

- **Server-authoritative**: the server holds the full state (both decks' order, every hand) and validates every action. Each client receives its own hand and public state only: hand sizes, deck counts, discard pile, played cards, castle progress.
- **Pure engine**: `applyAction(state, action) → { state, events }`, no I/O, rng injectable, unit-tested with Vitest. The deck order and shuffles of the discard pile never leave the server.
- **Latency**, **devices**, **language**, **persistence**: as Bomb Busters (§7 of its PRD): under 500 ms, phone width ≥ 360 px, EN and 中文 with a switch, in-memory rooms.

## 8. Success criteria

- A group of 4 and a solo player can each finish a full game without help and without the app ever allowing an illegal play.
- Engine tests cover every rule in §5: each combo rule, each suit power and its immunity, the power order, exact kill vs. overkill, shields stacking and floor at 0, Diamonds draw order and hand caps, an empty tavern deck, a Jester, both loss conditions, and the final King.
- No card in another player's hand, and no tavern deck order, appears in any other player's network traffic (verified by a socket test, as in Bomb Busters).

## 9. Rule decisions

The guide is silent or unclear on these. All are decided (owner approved the proposed defaults on 2026-10-18).

| ID | Question | Decision |
|---|---|---|
| ~~OQ-1~~ | The guide says an exact-killed enemy is worth "J=1, Q=2, K=3" once in hand. The official rules use its attack value (J=10, Q=15, K=20) and keep its suit. 1/2/3 makes an exact kill a weak card, at odds with "powerful ally". | **Decided:** J=10, Q=15, K=20, suit powers apply. Same values when discarded to take damage. |
| ~~OQ-2~~ | Which cards can an Ace accompany? Can an Ace join a set (A + 3-3)? Can two Aces be played together? | **Decided:** an Ace pairs with exactly one other card: any A–10, another Ace (A+A = 2), or an enemy card. An Ace can't join a set or a Jester. |
| ~~OQ-3~~ | The official rules let a player yield (play nothing, still take damage). The guide says a card must be played. | **Decided:** no yield, as the guide says. |
| ~~OQ-4~~ | The guide says the Jester cancels immunity "this turn", but a Jester deals no damage and can't be combined, so that would do nothing. | **Decided:** immunity is cancelled for the rest of the fight with that enemy. Spades played earlier against it don't apply retroactively. |
| ~~OQ-5~~ | The guide lets the player resolve multiple suits in any order. Order matters (e.g. Hearts before Diamonds can refill an empty deck). | **Decided:** fixed order ♥ → ♦ → ♠ → ♣, so no extra choice step. |
| ~~OQ-6~~ | Where do played cards go? (Hearts can only heal what is in the discard pile.) | **Decided:** they stay in a "played" area while the enemy lives (public), then all go to the discard pile when it's defeated. Cards discarded to take damage go to the discard pile at once. |
| ~~OQ-7~~ | After a Jester, the guide says "the next player may freely choose who starts the next turn". Who picks online? | **Decided:** the player who played the Jester picks the next player (any seat). |
| ~~OQ-8~~ | Can an enemy card in hand be played in a set with another enemy card of the same rank (e.g. J+J = 20)? | **Decided:** no. Sets must total ≤ 10, so enemy cards are only played alone or with an Ace. |

## 10. Roadmap after MVP

1. Official solo-mode Jester powers (refill hand), toggled in the lobby.
2. Victory tiers and a per-room history of results.
3. Quick reactions that respect "don't reveal your hand" (e.g. "I can take this", "Don't kill it yet").
4. Expansions or custom enemy decks, as data on top of the base engine.

## 11. Technical decisions

Same stack and conventions as Bomb Busters (TypeScript, React + Vite, Node + Socket.IO, Vitest, one Node service behind Caddy).

**Repo layout.** CLAUDE.md asks for one folder per game once there is a second game:

```
games/
  bomb-busters/   engine, server, client   (moved from packages/, still @bomb-busters/*)
  regicide/       engine, server, client   (@regicide/*)
host/             one Node entry: serves hub/ at /, each game's built client
                  under its base path, and attaches each game's Socket.IO
hub/index.html    adds the Regicide card
```

- `host` creates one HTTP server, serves each game's built client, and calls each game's `attach(http)` to add its Socket.IO. Each game owns its base path (`/boom-buster`, `/regicide`) and its Socket.IO path (`/regicide/socket.io`). `ecosystem.config.cjs` and `run.sh` point at `host`. Root scripts (`dev`, `build`, `test`, `typecheck`) cover every game; `npm run dev` runs the host plus both Vite servers.
- **Regicide engine** mirrors Bomb Busters': `setup.ts` (`createGame`, plus `createGameFromHands` for tests), `rules.ts` (`playKind`, `previewPlay`, `canCover`), `actions.ts` (`applyAction`: `play` (a Jester is a one-card play), `discard`, `chooseNext`), `view.ts` (`viewFor(state, playerId)` is the only thing sent to a client).
- **Phases**: `play` → (`discard` | `chooseNext` | next turn) → … → `won` / `lost`. `legal` in the view lists what the viewer may do now; the client uses `previewPlay` from the engine to show damage, and the server re-validates.
- **Card ids** are the card itself (`H7`, `SA`, `CJ`, `X1` for a Jester). Unlike Bomb Busters' wires, ids leak nothing, because hidden cards are never sent at all: other hands become counts and the tavern deck a count.
- **Room code**: `rooms.ts`, `server.ts` and `protocol.ts` follow Bomb Busters' structure (secret seat token, per-socket `broadcast`, public-only log). They're copied rather than shared for now. Once both games are on the new layout, the shared parts (room codes, names, seats, tokens, presence, cleanup) can move into a `@huddle/rooms` package; that's a follow-up, not part of this MVP.
- **Client** copies Bomb Busters' shell (`net.ts`, `paths.ts`, `storage.ts`, `Header`, `Home`, `Lobby`) and its CSS variables, so both games look like one site. The language key stays `huddle:lang`. New components: `Card` (playing cards), and in `Game`, the enemy panel, castle track, play preview, discard bar and Jester seat picker.
