import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { load, save } from './storage';

const en = {
  tagline: 'A cooperative wire-cutting deduction game for 2–5 players.',
  allGames: 'All games',
  room: 'Room',
  connecting: 'Connecting…',
  connectionLost: 'Connection lost. Reconnecting…',

  'difficulty.simple': 'Simple',
  'difficulty.medium': 'Medium',
  'difficulty.hard': 'Hard',
  redOne: '1 red wire',
  redMany: '{n} red wires',
  yellowNone: 'No yellow wires',
  yellowMany: '{n} yellow wires',
  diffChip: '{level} · {red} red · {yellow} yellow',

  yourName: 'Your name',
  namePlaceholder: 'e.g. Lin',
  createRoom: 'Create a room',
  joinTitle: 'Join a room',
  roomCode: 'Room code',
  join: 'Join',
  joinRoom: 'Join room {code}',
  backHome: 'Back to start',

  lobbyIntro: 'Share the link with your team. 2–5 players. Everyone plays on their own device.',
  roomLink: 'Room link',
  copyLink: 'Copy link',
  copied: 'Copied',
  difficultyTitle: 'Difficulty',
  difficultyNote: 'Chosen by the host. Every game uses all 48 blue wires (1–12, four of each).',
  howTitle: 'How a turn works',
  howDualLabel: 'Dual cut:',
  howDual: "point at a teammate's wire and name a value you hold. Right, and both wires are cut. Wrong, and the detonator moves.",
  howSoloLabel: 'Solo cut:',
  howSolo: 'cut your own wires when you hold every remaining copy of a value.',
  howEndLose: 'Lose',
  howEndLoseText: 'if a red wire is cut or the detonator runs out.',
  howEndWin: 'Win',
  howEndWinText: 'when every blue and yellow wire is cut.',
  players: 'Players',
  hostYou: 'Host · you',
  host: 'Host',
  youTag: 'You',
  reconnecting: 'Reconnecting…',
  openSeat: 'Open seat',
  seatNote:
    'Seat order is turn order. The first player is picked at random. The team can make players + 1 wrong guesses ({n} right now).',
  start: 'Start game · {level}',
  waitHost: 'Waiting for {name} to start.',
  needPlayers: 'At least 2 players are needed to start.',
  leave: 'Leave room',

  detonator: 'Detonator',
  mistakes: 'mistakes',
  detonatorLabel: 'Detonator: {used} of {allowed} allowed mistakes used. The next one after that explodes.',
  wiresLeft: '{n} wires left',
  nextTurn: 'Next turn',
  turnNow: 'Their turn',
  you: '(you)',
  yourTurn: 'YOUR TURN',
  waitingFor: "Waiting for {name}'s move.",
  paused: '{name} is reconnecting. The game waits for them.',
  wireLabel: "{name}'s wire #{n}",
  yourWireLabel: 'Your wire #{n}',
  hiddenWire: 'hidden',

  revealTitle: 'Setup: reveal one wire',
  revealHint: 'Tap one of your blue wires. The team sees its value once everyone has chosen.',
  revealWaiting: 'Waiting for the others: {done} of {total} have chosen.',

  cutHint: "Tap a teammate's wire, then tap one of your own wires. Your wire's value is your guess, and it's the one you cut.",
  pickTarget: "Tap a teammate's wire",
  pickYours: 'Tap one of your wires',
  confirmCut: "Confirm: cut {name}'s #{n} as {v}",
  warning: 'A wrong guess moves the detonator. A red wire ends the game.',
  soloCut: 'Solo cut your {v}s',
  soloCutYellow: 'Solo cut your yellows',
  soloAvail: 'Solo cut available for {list}: tap that wire to use it.',
  inPlayTitle: 'Special wires this game',
  inPlayBombs: 'Bombs',
  none: 'None',
  noMoves: 'You have no legal moves this turn.',
  pass: 'Pass',

  cutWires: 'Cut wires',
  yellow: 'Yellow',
  yellowShort: 'Y',
  red: 'Red',
  yellowCut: 'Yellow {cut} / {total} cut',
  log: 'Action log',
  logEmpty: 'Nothing yet.',
  'log.revealed': '{who} marked a wire',
  'log.dualCutSuccess': "{who} cut {target}'s #{n} as {v}",
  'log.dualCutMiss': "{who} guessed {v} on {target}'s #{n}. Miss, it's {actual}. Detonator {m}/{allowed}",
  'log.redWireCut': "{who} cut {target}'s #{n}. It was a red wire!",
  'log.soloCut': '{who} solo cut {count} × {v}',
  'log.passed': '{who} had no moves and passed',
  'log.gameWon': 'Bomb defused!',
  'log.gameLost.red-wire': 'The bomb exploded.',
  'log.gameLost.detonator': 'The detonator ran out.',

  won: 'Bomb defused',
  wonSub: 'Every blue and yellow wire is cut. Nice teamwork.',
  lostRed: 'Boom. Red wire cut',
  lostRedSub: "{who} cut {target}'s #{n}, and it was red.",
  lostDet: 'Boom. Detonator ran out',
  lostDetSub: 'That was mistake number {m}. The team was allowed {allowed}.',
  statCut: 'Wires cut',
  statMistakes: 'Mistakes',
  statTurns: 'Turns',
  racksShown: 'All racks are now face up, so the team can see where the red wires were.',
  playAgain: 'Play again',
  viewRacks: 'View racks',
  showResult: 'Show result',
  waitAgain: 'Waiting for {name} to start a new game.',

  'err.ROOM_NOT_FOUND': "That room doesn't exist. Check the code.",
  'err.ROOM_FULL': 'That room already has 5 players.',
  'err.GAME_IN_PROGRESS': 'A game is already running in that room.',
  'err.NAME_INVALID': 'Names must be 2–16 characters.',
  'err.NAME_TAKEN': 'Someone in the room already has that name.',
  'err.NOT_HOST': 'Only the host can do that.',
  'err.NOT_ENOUGH_PLAYERS': 'At least 2 players are needed.',
  'err.NOT_YOUR_TURN': "It's not your turn.",
  'err.TIMEOUT': 'The server did not answer. Try again.',
  'err.generic': 'That move was not allowed ({code}).',
};

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  tagline: '2–5 人合作推理剪线游戏。',
  allGames: '所有游戏',
  room: '房间',
  connecting: '连接中…',
  connectionLost: '连接已断开，正在重连…',

  'difficulty.simple': '简单',
  'difficulty.medium': '中等',
  'difficulty.hard': '困难',
  redOne: '1 根红色雷管',
  redMany: '{n} 根红色雷管',
  yellowNone: '没有黄色导线',
  yellowMany: '{n} 根黄色导线',
  diffChip: '{level} · {red} 红 · {yellow} 黄',

  yourName: '你的名字',
  namePlaceholder: '例如：小林',
  createRoom: '创建房间',
  joinTitle: '加入房间',
  roomCode: '房间号',
  join: '加入',
  joinRoom: '加入房间 {code}',
  backHome: '返回首页',

  lobbyIntro: '把链接分享给队友。2–5 人，每人用自己的设备游戏。',
  roomLink: '房间链接',
  copyLink: '复制链接',
  copied: '已复制',
  difficultyTitle: '难度',
  difficultyNote: '由房主选择。每局都使用全部 48 根蓝色导线（1–12，每种 4 根）。',
  howTitle: '回合怎么玩',
  howDualLabel: '双人拆弹：',
  howDual: '指定队友的一根导线，并说出一个你手里有的数字。猜对，两根导线都剪断；猜错，起爆器前进一格。',
  howSoloLabel: '单人拆弹：',
  howSolo: '当某个数字剩下的所有导线都在你手里时，可以自己剪断。',
  howEndLose: '失败：',
  howEndLoseText: '剪到红色雷管，或起爆器走到终点。',
  howEndWin: '胜利：',
  howEndWinText: '所有蓝色和黄色导线都被剪断。',
  players: '玩家',
  hostYou: '房主 · 你',
  host: '房主',
  youTag: '你',
  reconnecting: '重连中…',
  openSeat: '空位',
  seatNote: '座位顺序就是回合顺序，先手随机决定。队伍可以猜错「玩家人数 + 1」次（当前为 {n} 次）。',
  start: '开始游戏 · {level}',
  waitHost: '等待 {name} 开始游戏。',
  needPlayers: '至少需要 2 名玩家才能开始。',
  leave: '离开房间',

  detonator: '起爆器',
  mistakes: '次失误',
  detonatorLabel: '起爆器：已用 {used} / {allowed} 次允许的失误，再错一次就会爆炸。',
  wiresLeft: '剩 {n} 根',
  nextTurn: '下一位',
  turnNow: '当前回合',
  you: '（你）',
  yourTurn: '你的回合',
  waitingFor: '等待 {name} 行动。',
  paused: '{name} 正在重连，游戏暂停等待。',
  wireLabel: '{name} 的第 {n} 根导线',
  yourWireLabel: '你的第 {n} 根导线',
  hiddenWire: '未知',

  revealTitle: '准备：亮出一根导线',
  revealHint: '点选你的一根蓝色导线。所有人选完后，队友会看到它的数字。',
  revealWaiting: '等待其他玩家：{done} / {total} 人已选择。',

  cutHint: '先点队友的一根导线，再点你自己的一根导线：你这根的数字就是你的猜测，猜对时剪断的也是它。',
  pickTarget: '点选队友的一根导线',
  pickYours: '点选你自己的一根导线',
  confirmCut: '确认：把 {name} 的第 {n} 根剪成 {v}',
  warning: '猜错会让起爆器前进，剪到红色雷管游戏立即结束。',
  soloCut: '单人剪断你的 {v}',
  soloCutYellow: '单人剪断你的黄色导线',
  soloAvail: '可以单人剪断：{list}。点选那根导线即可。',
  inPlayTitle: '本局特殊导线',
  inPlayBombs: '炸弹',
  none: '无',
  noMoves: '你这回合没有可以执行的行动。',
  pass: '跳过',

  cutWires: '已剪断',
  yellow: '黄色',
  yellowShort: '黄',
  red: '红色',
  yellowCut: '黄色 {cut} / {total} 已剪',
  log: '行动记录',
  logEmpty: '暂无记录。',
  'log.revealed': '{who} 标记了一根导线',
  'log.dualCutSuccess': '{who} 把 {target} 的第 {n} 根剪成 {v}',
  'log.dualCutMiss': '{who} 猜 {target} 的第 {n} 根是 {v}，猜错了，其实是 {actual}。起爆器 {m}/{allowed}',
  'log.redWireCut': '{who} 剪了 {target} 的第 {n} 根，是红色雷管！',
  'log.soloCut': '{who} 单人剪断 {count} 根 {v}',
  'log.passed': '{who} 无可行动作，跳过回合',
  'log.gameWon': '炸弹已拆除！',
  'log.gameLost.red-wire': '炸弹爆炸了。',
  'log.gameLost.detonator': '起爆器走到了终点。',

  won: '炸弹已拆除',
  wonSub: '所有蓝色和黄色导线都已剪断，配合得漂亮！',
  lostRed: '轰！剪到了红色雷管',
  lostRedSub: '{who} 剪了 {target} 的第 {n} 根，那是红色雷管。',
  lostDet: '轰！起爆器走到终点',
  lostDetSub: '这是第 {m} 次失误，队伍只允许 {allowed} 次。',
  statCut: '已剪导线',
  statMistakes: '失误',
  statTurns: '回合数',
  racksShown: '所有牌架已翻开，大家可以看到红色雷管藏在哪里。',
  playAgain: '再来一局',
  viewRacks: '查看牌架',
  showResult: '查看结果',
  waitAgain: '等待 {name} 开始新的一局。',

  'err.ROOM_NOT_FOUND': '房间不存在，请检查房间号。',
  'err.ROOM_FULL': '这个房间已经有 5 名玩家了。',
  'err.GAME_IN_PROGRESS': '这个房间的游戏已经开始了。',
  'err.NAME_INVALID': '名字需要 2–16 个字符。',
  'err.NAME_TAKEN': '房间里已经有人用了这个名字。',
  'err.NOT_HOST': '只有房主可以这样做。',
  'err.NOT_ENOUGH_PLAYERS': '至少需要 2 名玩家。',
  'err.NOT_YOUR_TURN': '还没轮到你。',
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
