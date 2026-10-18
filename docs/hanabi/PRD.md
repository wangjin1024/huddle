# Hanabi Online: Product Requirements Document (MVP)

Status: Implemented with the proposed §9 decisions · Owner: wangjin1024 · Last updated: 2026-10-19
Rules reference: [`game_rules/hanabi.md`](../../game_rules/hanabi.md)
Visual design: the "Hanabi UI" canvas artifact (https://claude.ai/artifact/GPViGf7gknoMjHK1QibWyF)

## 1. Summary

A browser-based, real-time, online version of the cooperative card game **Hanabi (花火)**, the fourth game on Huddle (huddle.kinddot.net). 2–5 players share a room link and play from their own devices. Each player holds a hand they **can't see**, but they see everyone else's. On their turn a player gives a hint (spending a hint token), discards a card (getting one back), or plays a card to a firework. The team tries to build all five fireworks (red, yellow, blue, green, white) from 1 to 5 for a perfect 25, before three misplays blow it up or the deck runs out.

It reuses what the other games already proved: no accounts, join by link, a secret seat token per player, server-authoritative rules in a pure engine, EN/中文, and the same dark Huddle look.

## 2. Goals and non-goals

### Goals (MVP)
- Play a complete base-rules game online with 2–5 players, each on their own device.
- Keep each player's own hand hidden from them: not even the network payload tells a player what they hold. Everyone else's hand is visible.
- Enforce every rule automatically: the three actions, their token limits, hints that name every matching card, misplays, the final round, the score.
- Make hints easy to give and impossible to forget: before giving one, the giver sees exactly which cards it touches. After, every card shows what hints have said about it (and what they ruled out), for its owner and for everyone else.
- Make the public state easy to read at phone size: fireworks, tokens, deck, discards, whose turn it is.
- Share hosting with the other games: one Node service, one domain, picked from the Huddle hub.

### Non-goals (for now)
- Variants: the rainbow/multicolour suit, 6 colours, "no hint for rainbow", endless mode.
- Chat of any kind during the game (§5.6: the rules forbid talking about hands).
- Convention helpers: the app never tells a player what a hint "means" (play prompt, save prompt). It shows only what a hint literally said.
- Private notes on cards, bots, spectators, replays.
- Accounts, matchmaking, public lobbies.

## 3. Users

The same private groups who play the other Huddle games: friends or family, often on a voice call. Hanabi is quiet and slow: the whole game is about the few words a hint carries, so the app's job is to hold the hidden hands, show every hint's history on the cards so nobody has to memorise it, and keep the turn rules tight. Players who know the game well use conventions; the app should support them by being exact, not by playing for them.

## 4. User stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | host | create a room and share a link | friends can join quickly |
| U2 | player | join with just a nickname | I don't need an account |
| U3 | host | start once 2–5 players are in | we can begin |
| U4 | player | see every teammate's hand, but never my own | the game works like the real table |
| U5 | player on my turn | tap a teammate's card, choose "its colour" or "its number", and see every card the hint will touch before I give it | I don't give a hint I didn't mean |
| U6 | player | see on each of my cards what hints have told me, including what they ruled out | I don't have to remember every hint |
| U7 | player | see what each teammate knows about their own cards | I don't repeat a hint, and I see what they're missing |
| U8 | player on my turn | pick one of my cards and play or discard it | I take my turn in two taps |
| U9 | player | always see the hint tokens, misplays, deck count, fireworks and score | I know where we stand |
| U10 | player | see the discard pile grouped by colour and number | I know which cards are gone and which are the last copy |
| U11 | player | see a log of every action | I can follow what happened while I looked away |
| U12 | player | rejoin after a refresh or disconnect | one dropped connection doesn't end the game |
| U13 | team | see the final score with its rating, everyone's last hands, and play again | we can keep playing |

## 5. Game rules to implement (MVP)

Taken from the rules guide. Items marked **[OQ-n]** are unclear in the guide; §9 records the proposed decision for each.

### 5.1 Components
- **Deck**: 50 cards, 5 colours (red, yellow, blue, green, white) × 10:

  | Number | Copies per colour |
  |---|---|
  | 1 | 3 |
  | 2, 3, 4 | 2 each |
  | 5 | 1 |

- **Hint tokens**: 8. **Misplay tokens** (the fuse): 3.
- **Fireworks**: one stack per colour, built 1 → 5.

### 5.2 Setup
1. Seat 2–5 players (**[OQ-1]**).
2. Shuffle the deck. Deal **5 cards** each with 2–3 players, **4 cards** each with 4–5 players.
3. Put all 8 hint tokens in the pool, no misplays. The first player is chosen at random (**[OQ-2]**); turns go in seat order.

### 5.3 Turn
A turn is exactly **one** of these three actions.

**Give a hint** (needs at least 1 hint token; spends 1):
- Pick one teammate (never yourself) and either one **colour** or one **number**, never both.
- The hint names **every** card in that hand with that colour (or number). The app selects them all; the giver can't choose a subset.
- The hint must name at least one card (**[OQ-3]**). "You have no reds" isn't allowed.

**Discard** (only when fewer than 8 hint tokens are in the pool):
1. The card goes face up to the discard pile.
2. One hint token returns to the pool.
3. Draw a card, if the deck has any.

**Play a card**:
- If it's the next number its colour's firework needs, it's placed there. A **5** placed this way also returns 1 hint token (no effect if the pool is already at 8).
- Otherwise it's a **misplay**: the card goes to the discard pile and the team gains 1 misplay token.
- Either way, draw a card if the deck has any.

**Hand order** (**[OQ-4]**): a new card is drawn into the leftmost slot; the rest shift right and keep their order. Cards never move otherwise, so "your third card" means the same card until it leaves the hand. Players can't rearrange their hand.

### 5.4 What hints leave behind (card knowledge)
At a real table players remember hints. Online, the app remembers them (**[OQ-5]**). Each card in a hand carries what hints have said about it, and this is public (everyone saw the hint):
- **Positive**: a hint that named the card fixes its colour or number ("red", "2").
- **Negative**: a hint to that hand that did **not** name the card rules a value out ("not red", "not 2").

Each card shows its known colour and number, or, if unknown, the colours and numbers still possible. The app doesn't infer anything beyond what hints literally said: no card counting from the discard pile, no convention meaning.

### 5.5 End of game and score
The game ends immediately when:
1. **The third misplay** is made: the show blows up and the team scores **0** (**[OQ-6]**).
2. **All five fireworks reach 5**: a perfect 25.
3. **The final round ends**: when the last card is drawn from the deck, every player, the one who drew it included, takes one more turn, in seat order starting with the next player. The player who drew the last card takes the last turn (**[OQ-7]**). Nobody draws during the final round.

Otherwise the score is the sum of the five fireworks' top numbers. The result shows the rating from the guide:

| Score | Rating (EN) | 评价 |
|---|---|---|
| 25 | Flawless! A legendary fireworks master! | 完美无瑕！传奇级别的烟花大师！ |
| 21–24 | Outstanding: the crowd is amazed! | 非常出色，观众惊叹不已！ |
| 16–20 | A good show, with some fine moments. | 表现不错，一场可圈可点的表演。 |
| 11–15 | Just a pass: the crowd shrugs. | 勉强及格，观众反应平平。 |
| 0–10 | A disaster: the crowd walks out. | 惨不忍睹，观众纷纷退场。 |

### 5.6 Communication
The guide's core rule: players share information **only** through hints. The app copies that:
- **No chat** in a running game, and no emoji reactions (**[OQ-8]**). Groups on a voice call are on their honour, as at a real table.
- The app never shows a player anything about their own cards beyond hint knowledge (5.4).
- The action log and hint history are the shared record.

## 6. Functional requirements

### 6.1 Hub and rooms
- FR1: The Huddle hub (`/`) gets a fourth card, "Hanabi 花火", linking to `/hanabi/`.
- FR2: Create a room → short room code and link (`/hanabi/r/CODE`).
- FR3: Join by link or code with a nickname (2–16 characters, unique in the room). Up to 5 seats.
- FR4: The lobby shows the seats in turn order, the hand size for the current count ("4 players · 4 cards each"), and a short rules card. The host starts with 2–5 players.
- FR5: A game can't be joined after it starts. "Play again" returns everyone to the lobby, then deals a new shuffle.

### 6.2 Game screen (shared)
- FR6: **Status bar**: 8 hint tokens (spent ones dimmed), 3 misplay tokens (used ones lit red), deck count, current score "14 / 25", and the **best still possible** score (25 minus what discards have made unreachable) (**[OQ-9]**).
- FR7: **Turn banner**: "Your turn" or "Leo's turn", and in the final round "Final round · 3 turns left".
- FR8: **Fireworks**: five columns, one per colour, each showing its top card large and the cards 1–5 as pips (built ones lit). Colours always come with a **symbol** too (red ◆, yellow ★, green ●, blue ■, white ✦), so colour-blind players can tell them apart.
- FR9: **Teammates' hands**: one row per teammate, in turn order starting after you. Each card is face up (colour, number, symbol) with that card's knowledge strip underneath (what its owner knows: "R ?", "? 2", or the remaining possibilities). The current player's row is highlighted.
- FR10: **Your hand**: card backs in your slot order, each showing only your knowledge of it (known colour tints the back; known number printed; otherwise the still-possible colours and numbers as small dimmed/lit marks). The newest card has a small "new" tag until your next turn.
- FR11: **Discard pile**: a 5 × 5 grid (colour × number), each cell showing discarded copies out of the total (e.g. "2 of 3"). A cell where every copy is gone is crossed out; a cell with one copy left is marked "last copy".
- FR12: **Action log**: newest first. "Mia hinted Leo: 2 (cards 2, 4)", "Sam played Blue 3", "Ava misplayed Red 4 ✕", "Leo discarded Green 1, drew a card".
- FR13: The latest action is highlighted on the board for a few seconds: a played card flies to its firework; hinted cards pulse in the hinted hand.

### 6.3 Giving a hint
- FR14: On your turn, tapping a teammate's card opens the **hint composer** for that teammate with two choices: that card's colour and that card's number. (Tapping a hand's name opens it with all five colours and five numbers, the ones that touch nothing disabled.)
- FR15: Choosing one outlines every card it touches in that hand and labels the button with the result: "Tell Leo: 2 (2 cards)". Confirm gives the hint. Disabled with 0 hint tokens ("No hint tokens. Discard or play to get one back").

### 6.4 Playing or discarding
- FR16: On your turn, tapping one of your cards selects it and shows **Play** and **Discard**. Discard is disabled at 8 hint tokens ("All 8 hint tokens are in the pool").
- FR17: Play has no confirm step after it is pressed (one tap to select, one to play), but it is a separate button, never the card tap itself.
- FR18: After a play, everyone sees what the card was and whether it worked: green "Placed!" or red "Misplay" with the card shown.

### 6.5 Result and connection
- FR19: **Result overlay**: the score (or 0 and "Boom" on 3 misplays), the rating line, the five fireworks, and every player's final hand revealed, yours included. Play again.
- FR20: Rejoining from the same browser restores your seat (seat token, as in the other games).
- FR21: A disconnected player pauses the game when it's their turn; others keep their view. No timeout, no skipping.

## 7. Non-functional requirements

- **Server-authoritative**: the server holds the deck and every hand. A player's view contains other players' cards in full, and for their own hand only card ids and knowledge (5.4). The deck order is never sent, only its count. After the game ends, everyone gets all hands.
- **Card ids** never reveal a card. They're the order the card was drawn from the deck (`c0`–`c49`), which is public.
- **Pure engine**: `applyAction(state, action) → { state, events }`, no I/O, rng injectable for the shuffle, unit-tested with Vitest.
- **Latency**, **devices**, **language**, **persistence**: as the other games: under 500 ms, phone width ≥ 360 px, EN and 中文 UI with a switch, in-memory rooms.

## 8. Success criteria

- A group of 2 and a group of 5 can each finish a game without help, and the app never allows an illegal action.
- Engine tests cover every rule in §5: the deck's make-up, hand size by player count, hint token limits both ways, a hint naming every matching card and never zero, the 5-play token bonus (and its cap), misplays and the third misplay scoring 0, a perfect 25 ending the game at once, the final round (each player one more turn, no draws, the last-card drawer last), the new card's slot, and positive and negative knowledge.
- No player's own unplayed cards appear in their network traffic, and no deck order appears in anyone's (verified by a socket test, as in the other games).

## 9. Rule decisions

The guide is silent or unclear on these. Each has a **proposed** decision for the owner to confirm or change.

| ID | Question | Proposed decision |
|---|---|---|
| OQ-1 | How many players? The guide's deal table covers 2–5. | 2–5. |
| OQ-2 | Who goes first? | A random player. Turns go in seat order. |
| OQ-3 | Can a hint name zero cards ("you have no blue")? The guide says a hint must name all matching cards, but not whether there must be one. | No: a hint must name at least one card (the published rules say so). |
| OQ-4 | Where does a new card go, and can players rearrange? | Newest card on the left; nobody can rearrange. Positions are part of what hints mean, so they must be stable. |
| OQ-5 | The guide expects players to remember hints. Should the app? | Yes: each card shows what hints said about it, both positive and negative (5.4). Remembering is hard to do fairly online, and every online version does this. Nothing is inferred beyond the literal hints. |
| OQ-6 | Score after 3 misplays? Some editions keep the fireworks' score. | 0, as the guide says. |
| OQ-7 | Final round: who takes the last turn? | Every player gets exactly one more turn after the last card is drawn; the player who drew it goes last. |
| OQ-8 | Chat? The rules ban talking about hands. | No chat in a running game. Possibly a lobby-only chat later (§10). |
| OQ-9 | Show the "best still possible" score? It's public information (from the discard pile) but some players like to count it themselves. | Show it, small, in the status bar. |

## 10. Roadmap after MVP

1. The rainbow (multicolour) suit as a lobby option, then other common variants.
2. Private notes on your own cards ("probably 5, keep").
3. A lobby-only chat, and a replay of a finished game turn by turn.
4. A per-room history of scores.

## 11. Technical decisions

Same stack and layout as the other games (TypeScript, React + Vite, Node + Socket.IO, Vitest, one Node service behind Caddy).

```
games/hanabi/   engine, server, client   (@hanabi/*)
host/           adds Hanabi to GAME_PATHS, createHost, main.ts
hub/index.html  adds the Hanabi card
```

- **Base path** `/hanabi/`, rooms at `/hanabi/r/CODE`, socket at `/hanabi/socket.io`. Dev Vite on :5176. `BASE_PATH` in `server/src/protocol.ts` and `base` in `client/vite.config.ts` must match.
- **Engine**: `cards.ts` (colours, numbers, the deck), `setup.ts` (`createGame(players, rng)`, plus `createGameFromDeck` for tests), `rules.ts` (`touches(hand, hint)`, `canPlay`, `score`, `maxScore`), `actions.ts` (`applyAction`: `hint` `{ to, colour | number }`, `play` `{ cardId }`, `discard` `{ cardId }`), `view.ts` (`viewFor(state, playerId)`: own cards as `{ id, knowledge }` only).
- **Knowledge** is game state, updated by the engine on every hint, not by the client: per card, `colour?`, `number?`, `notColours`, `notNumbers`.
- **Phases**: `play` → (`finalRound`) → `won` / `lost` / `ended`. `legal` in the view lists what the viewer may do now (hint targets, whether discard is allowed).
- **Events** are all public. A play or discard event carries the card's face (it's public once it leaves the hand). A hint event carries the giver, target, value and the touched card ids.
- **Room code**: `rooms.ts`, `server.ts`, `protocol.ts` follow the other games (secret seat token, per-socket `broadcast`).
- **Client** copies the shared shell (`net.ts`, `paths.ts`, `storage.ts`, `Header`, `Home`, `Lobby`) and the CSS variables. The language key stays `huddle:lang`. New components: `Fireworks`, `Hand`, `CardFace`, `CardBack`, `Knowledge`, `HintComposer`, `DiscardGrid`, `Tokens`, `Log`.
