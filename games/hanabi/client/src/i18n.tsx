import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { load, save } from './storage';

const en = {
  tagline: "A cooperative card game for 2–5 players. You see everyone's cards but your own: give hints to build five fireworks from 1 to 5.",
  allGames: 'All games',
  room: 'Room',
  connecting: 'Connecting…',
  connectionLost: 'Connection lost. Reconnecting…',

  yourName: 'Your name',
  namePlaceholder: 'e.g. Lin',
  createRoom: 'Create a room',
  joinTitle: 'Join a room',
  roomCode: 'Room code',
  join: 'Join',
  joinRoom: 'Join room {code}',
  backHome: 'Back to start',

  lobbyIntro: 'Share the link with your team. 2–5 players, each on their own device.',
  roomLink: 'Room link',
  copyLink: 'Copy link',
  copied: 'Copied',
  setupTitle: 'Setup for {n} players',
  setupNote: 'Hand size is set by the number of players. It updates as people join.',
  nPlayers: '{n} players',
  handLabel: 'Cards each',
  howTitle: 'How to play',
  howGoalLabel: 'Build five fireworks,',
  howGoal: 'red, yellow, green, blue and white, each from 1 up to 5, for a perfect 25.',
  howHandLabel: "You can't see your own cards.",
  howHand: 'You see everyone else\'s. Teammates tell you about yours only through hints.',
  howTurnLabel: 'On your turn, do one thing:',
  howTurn:
    'give a hint (one colour or one number, naming every matching card in one hand; costs a hint token), discard a card (gets a token back), or play a card. Three misplays and the show blows up for 0 points.',
  players: 'Players',
  hostYou: 'Host · you',
  host: 'Host',
  youTag: 'You',
  reconnecting: 'Reconnecting…',
  openSeat: 'Open seat',
  seatNote: 'Seat order is turn order. The first player is picked at random.',
  start: 'Start game',
  needTwo: '2 to 5 players.',
  waitHost: 'Waiting for {name} to start.',
  leave: 'Leave room',

  'colour.R': 'Red',
  'colour.Y': 'Yellow',
  'colour.G': 'Green',
  'colour.B': 'Blue',
  'colour.W': 'White',
  cardName: '{colour} {n}',
  playersChip: '{n} players · {h} cards each',

  hintsLabel: 'Hints',
  misplaysLabel: 'Misplays',
  deckLabel: 'Deck',
  scoreLabel: 'Score',
  bestLabel: 'best {n}',
  hintsAria: '{n} of 8 hint tokens',
  misplaysAria: '{n} of 3 misplays',
  finalRound: 'Final round · {n} turns left',
  finalRoundOne: 'Final round · last turn',
  yourTurn: 'Your turn',
  yourTurnSub: 'Hint, discard or play',
  theirTurn: "{name}'s turn",
  paused: '{name} is reconnecting. The game waits for them.',
  fireworks: 'Fireworks',
  fireworkAria: '{colour} firework: {n}',

  next: 'next',
  turnNow: 'their turn',
  nCards: '{n} cards',
  hintFor: 'Hint {name}',
  knowsAria: '{name} knows: {k}',
  knowsNothing: 'nothing yet',
  knownIs: '{v}',
  couldBe: 'could be {v}',
  newTag: 'NEW',

  composerTitle: 'Hint for {name}',
  composerCard: 'About card {n}: name its colour or its number.',
  composerAll: 'Name one colour or one number. It names every matching card.',
  touchesOne: 'Names card {list}.',
  touchesMany: 'Names cards {list}.',
  alsoNot: '{name} also learns the other cards are not {v}.',
  tellCta: 'Tell {name}: {v} · {n} cards',
  tellCtaOne: 'Tell {name}: {v} · 1 card',
  cancel: 'Cancel',
  noHints: 'No hint tokens. Discard or play to get one back.',
  usesToken: 'uses 1 of {n} hint tokens',

  yourHand: 'Your hand',
  yourHandNote: "You can't see these. Each card shows what hints have told you.",
  tapToAct: 'Tap one of your cards to play or discard it.',
  cardN: 'card {n}',
  yourCardAria: 'Your card {n}: {k}',
  selectedSays: 'Card {n}. Hints said: {k}.',
  hintsSaidNothing: 'Card {n}. No hints about it yet.',
  playCta: 'Play card {n}',
  discardCta: 'Discard',
  discardPlus: '+1 hint',
  hintsFull: 'All 8 hint tokens are in the pool, so you can’t discard.',
  notColour: 'not {v}',

  discards: 'Discards',
  copiesLeft: 'copies left',
  legendLast: 'last copy',
  legendGone: 'all gone',
  legendPlayed: 'already played',
  cellAria: '{card}: {left} of {total} left',
  log: 'Log',
  logEmpty: 'Nothing yet.',
  turnShort: 'T{n}',

  'log.hinted': '{who} told {to}: {v} ({n})',
  'log.placed': '{who} played {card}: placed',
  'log.misplayed': '{who} misplayed {card}',
  'log.discarded': '{who} discarded {card}',
  'log.hintRegained': 'A firework reached 5: +1 hint',
  'log.finalRound': 'Last card drawn. Everyone gets one more turn.',
  'log.boom': 'Third misplay. The show blew up.',
  'log.perfect': 'All five fireworks reached 5!',
  'log.deck': 'The final round is over. Score {n}.',

  boomTitle: 'The show blew up.',
  boomKicker: 'Boom · third misplay',
  boomSub: 'Three misplays end the show with 0 points. The fireworks had reached {n}.',
  overKicker: 'Final round over',
  perfectKicker: 'Perfect show',
  'rating.25': 'Flawless! A legendary fireworks master!',
  'rating.21': 'Outstanding: the crowd is amazed!',
  'rating.16': 'A good show, with some fine moments.',
  'rating.11': 'Just a pass: the crowd shrugs.',
  'rating.0': 'A disaster: the crowd walks out.',
  statMisplays: 'Misplays',
  statHints: 'Hints given',
  statTurns: 'Turns',
  finalHands: 'Final hands',
  playAgain: 'Play again',
  backToTable: 'See the board',
  showResult: 'Show result',
  waitAgain: 'Waiting for {name} to start a new game.',

  'err.ROOM_NOT_FOUND': "That room doesn't exist. Check the code.",
  'err.ROOM_FULL': 'That room already has 5 players.',
  'err.GAME_IN_PROGRESS': 'A game is already running in that room.',
  'err.NAME_INVALID': 'Names must be 2–16 characters.',
  'err.NAME_TAKEN': 'Someone in the room already has that name.',
  'err.NOT_HOST': 'Only the host can do that.',
  'err.NOT_ENOUGH_PLAYERS': 'Hanabi needs at least 2 players.',
  'err.NOT_YOUR_TURN': "It's not your turn.",
  'err.CARD_NOT_IN_HAND': "That card isn't in your hand.",
  'err.NO_HINTS': 'No hint tokens left.',
  'err.HINTS_FULL': 'All 8 hint tokens are in the pool.',
  'err.SELF_HINT': "You can't hint yourself.",
  'err.EMPTY_HINT': 'A hint must name at least one card.',
  'err.GAME_OVER': 'The game is over.',
  'err.TIMEOUT': 'The server did not answer. Try again.',
  'err.generic': 'That move was not allowed ({code}).',
};

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  tagline: '2–5 人合作卡牌游戏。你能看到所有人的牌，唯独看不到自己的：用提示一起把五种烟花从 1 放到 5。',
  allGames: '全部游戏',
  room: '房间',
  connecting: '连接中…',
  connectionLost: '连接已断开，正在重连…',

  yourName: '你的名字',
  namePlaceholder: '例如：小林',
  createRoom: '创建房间',
  joinTitle: '加入房间',
  roomCode: '房间号',
  join: '加入',
  joinRoom: '加入房间 {code}',
  backHome: '返回首页',

  lobbyIntro: '把链接发给队友。2–5 人，每人用自己的设备。',
  roomLink: '房间链接',
  copyLink: '复制链接',
  copied: '已复制',
  setupTitle: '{n} 人局设置',
  setupNote: '手牌数由人数决定，会随加入人数更新。',
  nPlayers: '{n} 人',
  handLabel: '每人手牌',
  howTitle: '玩法',
  howGoalLabel: '放出五组烟花：',
  howGoal: '红、黄、绿、蓝、白，每种从 1 按顺序放到 5，满分 25。',
  howHandLabel: '你看不到自己的牌。',
  howHand: '你能看到其他人的牌。队友只能通过提示告诉你手里有什么。',
  howTurnLabel: '轮到你时，只做一件事：',
  howTurn: '给提示（一种颜色或一个数字，指出某人手中所有符合的牌；消耗一个提示标记）、弃一张牌（拿回一个标记），或打出一张牌。失误 3 次烟花爆炸，得 0 分。',
  players: '玩家',
  hostYou: '房主 · 你',
  host: '房主',
  youTag: '你',
  reconnecting: '重连中…',
  openSeat: '空位',
  seatNote: '按座位顺序轮流，先手随机。',
  start: '开始游戏',
  needTwo: '2 到 5 人可开局。',
  waitHost: '等待 {name} 开始游戏。',
  leave: '离开房间',

  'colour.R': '红',
  'colour.Y': '黄',
  'colour.G': '绿',
  'colour.B': '蓝',
  'colour.W': '白',
  cardName: '{colour} {n}',
  playersChip: '{n} 人 · 每人 {h} 张',

  hintsLabel: '提示',
  misplaysLabel: '失误',
  deckLabel: '牌堆',
  scoreLabel: '得分',
  bestLabel: '最多 {n}',
  hintsAria: '提示标记 {n} / 8',
  misplaysAria: '失误 {n} / 3',
  finalRound: '最后一轮 · 还剩 {n} 回合',
  finalRoundOne: '最后一轮 · 最后一回合',
  yourTurn: '轮到你了',
  yourTurnSub: '提示、弃牌或出牌',
  theirTurn: '轮到 {name}',
  paused: '{name} 正在重连，游戏会等他们回来。',
  fireworks: '烟花',
  fireworkAria: '{colour}色烟花：{n}',

  next: '下一位',
  turnNow: '正在行动',
  nCards: '{n} 张',
  hintFor: '提示 {name}',
  knowsAria: '{name} 知道：{k}',
  knowsNothing: '还不知道',
  knownIs: '{v}',
  couldBe: '可能是 {v}',
  newTag: '新',

  composerTitle: '给 {name} 的提示',
  composerCard: '关于第 {n} 张：说出它的颜色或数字。',
  composerAll: '说出一种颜色或一个数字，会指出所有符合的牌。',
  touchesOne: '指出第 {list} 张。',
  touchesMany: '指出第 {list} 张。',
  alsoNot: '{name} 也会知道其他牌不是{v}。',
  tellCta: '告诉 {name}：{v} · {n} 张',
  tellCtaOne: '告诉 {name}：{v} · 1 张',
  cancel: '取消',
  noHints: '没有提示标记了。弃牌或出牌可以拿回。',
  usesToken: '消耗 1 个（共 {n} 个）',

  yourHand: '你的手牌',
  yourHandNote: '你看不到这些牌。每张牌上显示提示告诉过你的信息。',
  tapToAct: '点一张自己的牌来打出或弃掉。',
  cardN: '第 {n} 张',
  yourCardAria: '你的第 {n} 张：{k}',
  selectedSays: '第 {n} 张。提示说过：{k}。',
  hintsSaidNothing: '第 {n} 张。还没有关于它的提示。',
  playCta: '打出第 {n} 张',
  discardCta: '弃牌',
  discardPlus: '+1 提示',
  hintsFull: '8 个提示标记都在，不能弃牌。',
  notColour: '不是{v}',

  discards: '弃牌堆',
  copiesLeft: '剩余张数',
  legendLast: '最后一张',
  legendGone: '已全部弃掉',
  legendPlayed: '已打出',
  cellAria: '{card}：剩 {left} / {total}',
  log: '记录',
  logEmpty: '还没有动作。',
  turnShort: '第{n}回',

  'log.hinted': '{who} 提示 {to}：{v}（{n} 张）',
  'log.placed': '{who} 打出 {card}：成功',
  'log.misplayed': '{who} 打出 {card}：失误',
  'log.discarded': '{who} 弃掉 {card}',
  'log.hintRegained': '一组烟花完成到 5：+1 提示',
  'log.finalRound': '最后一张牌已摸走，每人再行动一回合。',
  'log.boom': '第 3 次失误，烟花爆炸了。',
  'log.perfect': '五组烟花全部放到 5！',
  'log.deck': '最后一轮结束，得分 {n}。',

  boomTitle: '烟花爆炸了。',
  boomKicker: '爆炸 · 第 3 次失误',
  boomSub: '失误 3 次，本局 0 分。烟花本已放到 {n}。',
  overKicker: '最后一轮结束',
  perfectKicker: '完美演出',
  'rating.25': '完美无瑕！传奇级别的烟花大师！',
  'rating.21': '非常出色，观众惊叹不已！',
  'rating.16': '表现不错，一场可圈可点的表演。',
  'rating.11': '勉强及格，观众反应平平。',
  'rating.0': '惨不忍睹，观众纷纷退场。',
  statMisplays: '失误',
  statHints: '提示次数',
  statTurns: '回合数',
  finalHands: '最终手牌',
  playAgain: '再来一局',
  backToTable: '查看牌桌',
  showResult: '查看结果',
  waitAgain: '等待 {name} 开始新的一局。',

  'err.ROOM_NOT_FOUND': '房间不存在，请检查房间号。',
  'err.ROOM_FULL': '这个房间已经有 5 名玩家了。',
  'err.GAME_IN_PROGRESS': '这个房间的游戏已经开始了。',
  'err.NAME_INVALID': '名字需要 2–16 个字符。',
  'err.NAME_TAKEN': '房间里已经有人用了这个名字。',
  'err.NOT_HOST': '只有房主可以这样做。',
  'err.NOT_ENOUGH_PLAYERS': '花火至少需要 2 名玩家。',
  'err.NOT_YOUR_TURN': '还没轮到你。',
  'err.CARD_NOT_IN_HAND': '这张牌不在你手里。',
  'err.NO_HINTS': '没有提示标记了。',
  'err.HINTS_FULL': '8 个提示标记都在。',
  'err.SELF_HINT': '不能提示自己。',
  'err.EMPTY_HINT': '提示至少要指出一张牌。',
  'err.GAME_OVER': '游戏已经结束。',
  'err.TIMEOUT': '服务器没有响应，请重试。',
  'err.generic': '这一步不被允许（{code}）。',
};

export type Lang = 'en' | 'zh';
const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, zh };

type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Translate } | null>(null);

function initialLang(): Lang {
  const saved = load('huddle:lang');
  if (saved === 'en' || saved === 'zh') return saved;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    save('huddle:lang', l);
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  }, []);
  const t = useCallback<Translate>(
    (key, params) =>
      MESSAGES[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? `{${name}}`)),
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}

/** Translates a server error code, falling back to a generic message. */
export function errorText(t: Translate, code: string) {
  const key = `err.${code}` as MessageKey;
  return key in en ? t(key) : t('err.generic', { code });
}
