# Codenames Online: Product Requirements Document (MVP)

Status: Draft · Owner: wangjin1024 · Last updated: 2026-10-18
Rules reference: [`game_rules/codenames_game_rules.md`](../../game_rules/codenames_game_rules.md)
Visual design: the "Codenames UI" canvas artifact (https://claude.ai/artifact/Ku53c53xAUGTmoJku26gYV)

## 1. Summary

A browser-based, real-time, online version of the word-association game **Codenames (代号)**, the third game on Huddle (huddle.kinddot.net). Huddle only hosts cooperative games, so this is the guide's **cooperative mode** (§2 of the rules), not the red-vs-blue match: the whole room is one team against the board. One player is the **Spymaster** and sees the secret key. Everyone else is an **Operative** and sees only the 25 words. The Spymaster gives one-word clues with a number, and the Operatives try to find all 9 of their agents before the 9 timer tokens run out, without touching the assassin.

It reuses what the other two games already proved: no accounts, join by link, a secret seat token per player, server-authoritative rules in a pure engine, EN/中文, and the same dark Huddle look.

## 2. Goals and non-goals

### Goals (MVP)
- Play a complete cooperative game online with 2–8 players, each on their own device.
- Keep the key hidden: no Operative can see a card's colour before it is revealed, not even in the network payload.
- Make the Spymaster's job clear: the key is laid over the board, found and remaining agents are obvious, and the clue form blocks the clue mistakes the app can detect.
- Make guessing a team decision: Operatives talk it over in the room chat, each picks a word, and the turn's captain can only confirm a reveal once every pick is the same.
- Word boards in English and Chinese, chosen per room, independent of the UI language.
- Share hosting with the other games: one Node service, one domain, picked from the Huddle hub.

### Non-goals (for now)
- The competitive two-team mode (§1 of the guide). It's player-vs-player, which Huddle doesn't host.
- Duet (§3 of the guide). It's cooperative and on the roadmap (§10), but its two-sided key needs its own rules work.
- Judging clue *meaning* (homophones, positional hints, rule 4.3–4.5). The app can't, so the table does.
- Voice in the app (groups can still use their own call), bots, spectators, custom word lists.
- Accounts, matchmaking, public lobbies.

## 3. Users

The same private groups who play Bomb Busters and Regicide: friends or family, on a voice call or not. Codenames is the most social of the three: Operatives argue, the Spymaster must keep a straight face. The app's job is to hold the key, give the team a place to argue (the chat) and a way to agree (picks plus a captain), enforce the turn rules, and make the board easy to read at phone size, in both languages.

## 4. User stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | host | create a room, pick the word language, and share a link | friends can join quickly |
| U2 | player | join with just a nickname | I don't need an account |
| U3 | host | choose who is Spymaster (or pick at random) and start with 2–8 players | we can begin |
| U4 | Spymaster | see every word's secret colour on the board | I can plan clues |
| U5 | Spymaster | type a one-word clue and a number, and be told if the app spots a problem | I don't give an illegal clue by accident |
| U6 | Operative | see the current clue, guesses left, and timer tokens at all times | I know where we stand |
| U7 | Operative | discuss the clue with my team in a chat | we can argue it out, even without a voice call |
| U8 | Operative | pick the word I think is right and see everyone's pick | we know when we all agree |
| U12 | captain this turn | confirm the reveal once everyone picked the same word, or end the turn once everyone picked "Stop" | no one flips a card the team didn't agree on |
| U13 | Spymaster | read the chat during the game but not post in it | I can follow the team's thinking without giving hints |
| U9 | player | see the clue history with what each clue found | we can return to an old clue with the bonus guess |
| U10 | player | rejoin after a refresh or disconnect | one dropped connection doesn't end the game |
| U11 | team | see the full key at the end, and play again with a new board and a new Spymaster | we can keep playing |

## 5. Game rules to implement (MVP)

Taken from §2 of the rules guide (cooperative mode), with turn details from §1.2 where §2 refers to them. Items marked **[OQ-n]** are unclear in the guide; §9 records the proposed decision for each.

### 5.1 Components
- **Board**: 25 word cards in a 5 × 5 grid, drawn from the room's vocabulary (English or Chinese, **[OQ-1]**; see 5.7). No word appears twice.
- **Key**: a random assignment of the 25 positions:

  | Type | Count | Colour |
  |---|---|---|
  | Agent (target) | 9 | team colour (blue) |
  | Rival agent | 8 | red |
  | Bystander | 7 | neutral beige |
  | Assassin | 1 | black |

  The guide's cooperative mode keeps the competitive key card and uses the starting team's 9 as targets, so the 8 rival agents stay on the board (**[OQ-2]** for what they do).
- **Timer tokens**: set by the room's **difficulty** (**[OQ-13]**). One is spent per clue.

  | Difficulty | Timer tokens | Pace needed for 9 agents |
  |---|---|---|
  | Easy | 9 | about 1 agent per clue |
  | Medium (default) | 7 | some clues must link 2 words |
  | Hard | 5 | nearly every clue must link 2 |

### 5.2 Setup
1. Seat 2–8 players. One is the Spymaster (host's choice in the lobby, or random), the rest are Operatives.
2. Deal 25 words, generate the key. The Spymaster sees it, the Operatives don't.
3. Put the difficulty's timer tokens on the table (9 / 7 / 5).

### 5.3 Turn
A turn is one clue and the guessing that follows.

**Step 1: Clue.** The Spymaster submits one word and a number from 1 to 9 (**[OQ-3]**). Submitting it spends one timer token.

**Step 2: Guessing.** Operatives reveal words one at a time, each only after the team agrees (5.3.1). Up to *number + 1* reveals are allowed this turn.
- **Agent**: it's revealed blue. If guesses remain, the Operatives may keep going or end the turn.
- **Bystander**: revealed beige. The turn ends.
- **Rival agent**: revealed red. The turn ends.
- **Assassin**: revealed black. The team loses at once.

After at least one reveal, the Operatives may end the turn by agreeing to stop (5.3.1). The turn also ends when the last allowed reveal is used.

#### 5.3.1 Agreeing on a guess: picks and the captain
- **Captain**: each clue has one captain, an Operative. It rotates through the Operatives in seat order, one clue each, starting from the first Operative after the Spymaster. The captain picks like everyone else, and is the only one who can confirm.
- **Pick**: every Operative has at most one pick at a time, either an unrevealed word or **Stop** (Stop is only offered after the first reveal of the turn). Picking again replaces your pick. Tapping your pick again clears it. Everyone sees everyone's pick.
- **Agreement**: when every *connected* Operative has the same pick, the captain's **Confirm** button turns on: "Reveal SHELL" or "End turn". Until then it shows who is missing or who disagrees ("Sam picked WAVE").
- **Confirm** reveals the word (or ends the turn). All picks are cleared after each confirm, so the next guess starts fresh.
- If any pick changes, Confirm turns off again. The server checks agreement again at the moment the captain confirms.
- With a single Operative, they're always the captain and their own pick agrees, so it's pick, then confirm.

### 5.4 End of game
- **Win**: the 9th agent is revealed. This happens immediately, even mid-turn.
- **Loss**: the assassin is revealed, or a turn ends with no timer tokens left and at least one agent still hidden.

### 5.5 Clue rules (guide §4)
The app enforces what it can check on text; the rest is the table's job, as at a real table.

| Guide rule | App behaviour |
|---|---|
| 4.1 One word, not a phrase | **Blocked**: no spaces; at most 24 characters. English clues are letters plus `'` and `-`. Chinese clues are Chinese characters only, at most 4 (**[OQ-5]**). |
| 4.2 No overlap with a word still on the board | **Blocked** against any **unrevealed** board word (revealed words are fine). English, case-insensitive: the clue can't start or end with a board word, or be the start or end of one (SNOW/SNOWMAN, ISLAND/ISLANDS, CASE/BOOKCASE are blocked; ART/PARTY is fine). Chinese: neither may contain the other. |
| 4.2 No translations of a board word (e.g. "Apple" for 苹果) | Not checked. Shown as a reminder under the form. |
| 4.3 No position, length, or shape hints | Not checked. Reminder. |
| 4.4 No homophones or puns | Not checked. Reminder. |
| 4.5 Spymaster stays neutral | Not checked. The Spymaster's view says "Your team can't see colours. Keep a straight face." |

The Spymaster can't pick words, confirm, or end the turn.

### 5.6 Communication: the room chat
At a real table, Operatives talk freely and the Spymaster says nothing but the clue. The app copies that:
- One **chat** per room, shared by all players. It's open in the lobby and after the game for everyone.
- **During a game, only Operatives can post.** The Spymaster can read it (like hearing the table) but the input is replaced with "Spymasters stay silent". Their clue is the only thing they say.
- Game events appear in the chat as system lines, in the order they happened: the clue, each reveal and its result.
- **The chat only keeps the current round** (to keep server memory small). A round is one clue and its guessing. When the turn ends, the chat is cleared and starts again with the next round's talk. Messages sent while the Spymaster is thinking belong to the next round. In the lobby the chat is one round until the game starts, and after the game it's one round until Play again. The game's lasting record is the clue history (FR9), which is game state, not chat.
- Messages: 1–200 characters, plain text, no links rendered. Only the **last 10 lines** are kept (**[OQ-14]**), counting game lines too; older ones drop off. At most 5 messages per player per 5 seconds.
- Groups on a voice call can still talk there. The app can't police voice, so a Spymaster on a call is on their honour.

### 5.7 Vocabulary

**Built-in lists.** Our own lists, written for this game, not copied from the published one: **400 English** and **400 Chinese** words. The Chinese list is chosen on its own, not translated from the English. Every built-in word follows these rules:
1. A common, concrete noun. No proper names, brands, slang or rare words. Chinese words are 1–3 characters.
2. Prefer words with more than one meaning (SHELL, CROWN, 针, 火): they make better clues.
3. No two words in a list overlap by the 4.2 rule above (SNOW / SNOWMAN, 雪 / 雪人). Otherwise the clue check (5.5) would block fair clues and the board would give itself away.
4. Nothing offensive or upsetting.

**Player words (Chinese rooms only).** Before each game, in the lobby, every player (the Spymaster too) may add **up to 3 new words** of their own (**[OQ-12]**):
- They're checked like built-in words where the app can: 1–4 Chinese characters, Chinese characters only, not already added by someone else, and not containing or contained in another added word. A word that fails shows why, without revealing another player's word ("已有人添加了重叠的词，换一个").
- Added words are **guaranteed on the board**. The rest of the 25 are drawn at random from the built-in list, skipping any built-in word that overlaps an added word.
- Before the game starts, everyone sees the count of added words ("已添加 7 个新词") but not the words themselves, so the board is still a surprise. The host can see the words and remove any (rule 4 is the host's call).
- Added words last for that game only. "Play again" returns to the lobby with nothing added, and everyone can add up to 3 again.
- At most 8 players × 3 = 24 added words, so a board always has room for at least one built-in word.

**Drawing a board.** The server draws the 25 words, avoiding the previous game's words in the same room while the built-in list has enough left. Then it assigns the key at random (9 / 8 / 7 / 1). Which player added a word has no effect on its colour.

## 6. Functional requirements

### 6.1 Hub and rooms
- FR1: The Huddle hub (`/`) gets a third card, "Codenames 代号", linking to `/codenames/`.
- FR2: Create a room → short room code and link (`/codenames/r/CODE`).
- FR3: Join by link or code with a nickname (2–16 characters, unique in the room). Up to 8 seats.
- FR4: The lobby shows the seats, the **Spymaster picker** (tap a seat to make them Spymaster, or "Random"), the **word language** (English / 中文, default the host's UI language), and the **difficulty** (Easy / Medium / Hard, default Medium, each showing its token count). The host can start with 2–8 players and a Spymaster chosen.
- FR4a: In a Chinese room, the lobby has **My new words**: up to 3 inputs with live checks (5.7), each removable until the game starts, and a count of everyone's words. The host also sees the full list with a remove button on each.
- FR5: A game can't be joined after it starts. "Play again" returns to the lobby (player words cleared), then deals a new board, and passes the Spymaster role to the next seat (the host can change it in the lobby).

### 6.2 Game screen (shared)
- FR6: **Status bar**: role badge (Spymaster / Operative), agents found "4 / 9", and the 9 timer tokens (spent ones dimmed), visible to everyone.
- FR7: **Board**: the 5 × 5 grid fills the width (phone: about 64 px tiles at 360 px). Long words shrink to fit on one line. Revealed cards show their colour and keep the word readable. A revealed agent also shows which clue found it.
- FR8: **Clue banner**: the current clue big ("FRUIT · 2"), guesses used vs. allowed ("1 of 3"), and whose turn step it is ("Waiting for the Spymaster…" / "Operatives are guessing").
- FR9: **Clue history**: each clue with its number and the words it revealed, coloured. It's the only record of past rounds, since the chat is cleared each round.
- FR10: **Players**: names with role, connection state, each Operative's colour, the **captain** badge, and their current pick (or "thinking…").
- FR10a: **Chat**: a side panel on desktop, a sheet behind a "Chat" button with an unread count on phone. Messages show the sender's colour and name; system lines (clues, reveals) are styled apart. Enter sends.

### 6.3 Spymaster view
- FR11: The board shows every unrevealed word's key colour as a tinted tile with a coloured edge. The assassin has a distinct pattern, not only colour. Revealed cards are drawn darker, so the remaining work stands out.
- FR12: **Clue form** (only in the clue step): word input, number stepper 1–9, "Give clue" button. A blocked clue disables the button and says why ("Too close to 'APPLE' on the board"). The §5.5 reminders sit under the form.
- FR13: During guessing, the Spymaster sees the picks and the chat live but can't act or post.

### 6.4 Operative view
- FR14: Tapping a word makes it **your pick** (your colour dot on the tile, visible to everyone). Tapping another word moves it; tapping it again clears it. A **Stop** chip next to the board is the "end the turn" pick, shown after the first reveal.
- FR15: **Agreement bar** under the board: everyone's dot and pick in a row ("Mia SHELL · Leo SHELL · Sam WAVE · Ava …"), and the state: "Waiting for Ava", "Not agreed yet", or "Everyone picked SHELL".
- FR15a: **Captain**: the bar holds a **Confirm** button, enabled only on agreement, labelled "Reveal SHELL" or "End turn". Non-captains see "Leo (captain) will confirm".
- FR16: A reveal animates the tile flipping to its colour for everyone, and the chat's system line says the captain confirmed it.

### 6.5 Result and connection
- FR17: **Result overlay**: win/loss, agents found, tokens left, clues given, and the **full key** revealed on the board for everyone. Play again.
- FR18: Rejoining from the same browser restores your seat and role (seat token, as in the other games).
- FR19: If the Spymaster disconnects during the clue step, the game pauses until they're back. A disconnected Operative doesn't count toward agreement, and their pick is cleared. If the captain disconnects, the captaincy moves to the next connected Operative for the rest of that turn. If no Operative is connected, the game pauses. No timeout.

## 7. Non-functional requirements

- **Server-authoritative**: the server holds the key and validates every action. An Operative's view contains the 25 words, the type of **revealed** cards only, picks, the captain, clues, tokens, and the chat. The Spymaster's view also contains the key. After the game ends, everyone gets the key.
- **Pure engine**: `applyAction(state, action) → { state, events }`, no I/O, rng injectable for the word draw and the key, unit-tested with Vitest.
- **Word lists**: 400 English and 400 Chinese built-in words, stored as data in the engine (`words/en.ts`, `words/zh.ts`). Player words live in the room, cleared each game, so memory stays bounded (at most 24 per room).
- **Latency**, **devices**, **language**, **persistence**: as the other games: under 500 ms, phone width ≥ 360 px, EN and 中文 UI with a switch, in-memory rooms.

## 8. Success criteria

- A group of 2 and a group of 6 can each finish a game without help, and the app never allows an illegal turn step.
- Engine tests cover every rule in §5: the token count per difficulty, each reveal type, the number + 1 limit, ending a turn early (not before one reveal), timer token use, winning mid-turn on the 9th agent, losing on the assassin and on tokens running out, and each blocked clue rule.
- Word tests: each built-in list has exactly 400 unique entries, follows the length rule, and has no word containing another. Player words: the 3-per-player limit, character and length checks, overlap with other added words, every added word appears on the board, overlapping built-in words are skipped, the previous board's words are avoided, words are cleared on Play again, and non-hosts never receive others' added words before the game.
- Engine/server tests cover agreement: Confirm refused until every connected Operative picks the same thing, refused for non-captains, refused if a pick changed just before; picks cleared after each confirm; captain rotation; captain and Operative disconnects; a lone Operative.
- Server tests cover chat: the Spymaster can't post during a game but can in the lobby and after it, length and rate limits, and the chat is emptied when a turn ends.
- No unrevealed card's type appears in any Operative's network traffic (verified by a socket test, as in the other games).

## 9. Rule decisions

The guide is silent or unclear on these. Each has a **proposed** decision for the owner to confirm or change.

| ID | Question | Proposed decision |
|---|---|---|
| OQ-1 | Words in which language? A mixed board? | One language per room, chosen in the lobby. No mixed boards. |
| OQ-2 | In cooperative mode, what does revealing a rival (red) agent do? The guide says only "ends the turn", the same as a bystander. The official co-op variant has the rival team reveal one of its own agents each turn. | Follow the guide: a rival agent ends the turn, like a bystander. It's drawn in red so the history is honest. A harder variant can follow later as a lobby option. |
| OQ-3 | The guide says "a number" without bounds. The official rules allow 0 and ∞. | 1–9 only. |
| ~~OQ-4~~ | Online, who presses Reveal and End turn? | **Decided (owner, 2026-10-18):** every connected Operative must pick the same word (or Stop), then the turn's captain confirms. See §5.3.1. |
| OQ-5 | What counts as "one word" in Chinese, where there are no spaces? | At most 4 characters, no spaces or punctuation. The table judges the rest. |
| OQ-6 | When does the token-out loss trigger? | When the turn that used the last token ends with agents still hidden. A win during that turn still counts. |
| OQ-7 | Minimum players? The guide says 1–4 for co-op, but solo can't work online (the Spymaster needs a guesser) and the mode works fine with more. | 2–8. |
| ~~OQ-8~~ | Is there a chat, and can the Spymaster use it? | **Decided (owner, 2026-10-18):** one room chat. During a game the Spymaster can read but not post. See §5.6. |
| OQ-9 | Who is captain? | Rotates one clue at a time through the Operatives in seat order. |
| OQ-10 | Does "everyone" include disconnected Operatives? Waiting for them would freeze the game. | No: only connected Operatives count. A disconnected captain hands over to the next connected Operative. |
| ~~OQ-11~~ | How long is chat kept? | **Decided (owner, 2026-10-18):** one round only. Cleared when each turn ends. |
| ~~OQ-12~~ | Where do the words come from? | **Decided (owner, 2026-10-18):** English uses the 400 built-in words. Chinese uses the 400 built-in words plus up to 3 new words per player, added in the lobby before each game and always placed on the board. See 5.7. (The details there, such as hidden from others until the deal, host can remove, and a 4-character limit, are proposed.) |
| ~~OQ-13~~ | 9 tokens for 9 agents makes the game too easy. | **Decided (owner, 2026-10-18):** difficulty levels set the timer tokens: Easy 9, Medium 7 (default), Hard 5. Chosen by the host in the lobby. (The exact counts are proposed.) |
| ~~OQ-14~~ | How many chat lines does the server keep? | **Decided (owner, 2026-10-18):** only the last 10, to save memory. Game lines (clue, reveals) count toward the 10; the current clue is always in the clue banner anyway. |

## 10. Roadmap after MVP

1. **Duet** (2 players, two-sided key, both give and guess), after its rules are decided in a §9 follow-up.
2. Harder co-op variant: rival agents reveal themselves each turn; fewer timer tokens.
3. Player words for English rooms too, and saved word lists a room can reuse.
4. Quick reactions in the chat ("Not sure", "Yes!").
5. A per-room history of results (tokens left, wins).

## 11. Technical decisions

Same stack and layout as the other games (TypeScript, React + Vite, Node + Socket.IO, Vitest, one Node service behind Caddy).

```
games/codenames/   engine, server, client   (@codenames/*)
host/              adds Codenames to GAME_PATHS, createHost, main.ts
hub/index.html     adds the Codenames card
```

- **Base path** `/codenames/`, rooms at `/codenames/r/CODE`, socket at `/codenames/socket.io`. Dev Vite on :5175. `BASE_PATH` in `server/src/protocol.ts` and `base` in `client/vite.config.ts` must match.
- **Engine**: `words/` (lists, plus `checkWord` for player words), `setup.ts` (`createGame(players, spymaster, lang, extraWords, avoidWords, rng)`, plus `createGameFromBoard` for tests), `rules.ts` (`checkClue` returns ok or a reason key, `guessesLeft`, win/loss), `actions.ts` (`applyAction`: `clue`, `pick` (a word, `stop`, or none), `confirm` (captain only; reveals or ends the turn when all connected picks agree)), `view.ts` (`viewFor(state, playerId)`; key only for the Spymaster, or for everyone after the game ends).
- **Card ids** are positions (`0`–`24`), never derived from the key.
- **Phases**: `clue` → `guess` → `clue` … → `won` / `lost`. `legal` in the view lists what the viewer may do. The client calls `checkClue` from the engine to give instant form feedback, and the server re-checks.
- **Picks** and the **captain** are game state, public to the room, not events. Picks are cleared after every confirm. The engine takes the set of connected players as input to `confirm` (the server knows presence; the engine stays pure).
- **Chat** lives in the room (`rooms.ts`), not the engine: a list of `{ seat, text, at }` plus system lines generated from engine events, capped at the last 10 lines and emptied when the engine emits `turnEnded` (and on game start and Play again). Nothing about the chat is kept per game. A new `chat` socket event; the server rejects posts from the Spymaster while a game is running. The engine's `events` are all public (clue, reveal and type, turn end), so they go into the chat as-is.
- **Room code**: `rooms.ts`, `server.ts`, `protocol.ts` follow the other games (secret seat token, per-socket `broadcast`).
- **Client** copies the shared shell (`net.ts`, `paths.ts`, `storage.ts`, `Header`, `Home`, `Lobby`) and the CSS variables. The language key stays `huddle:lang`. New components: `Board`, `WordTile`, `ClueForm`, `ClueBanner`, `ClueHistory`, `Tokens`, `AgreementBar`, `Chat`.
