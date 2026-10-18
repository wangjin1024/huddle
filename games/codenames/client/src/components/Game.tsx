import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { CLUE_MAX, CLUE_NUMBER_MAX, CLUE_NUMBER_MIN, checkClue, type CardType, type GameView, type Pick } from '@codenames/engine';
import type { RoomView } from '@codenames/server/protocol';
import { errorText, useI18n } from '../i18n';
import { api } from '../net';
import { colorOf, initialOf, nameOf, pickText, typeKey } from '../format';
import { Chat } from './Chat';
import { ChatIcon, EyeIcon, TypeGlyph } from './Icons';
import { Header } from './Header';
import { Result } from './Result';

interface GameProps {
  room: RoomView;
  onError: (code: string) => void;
  onLeave: () => void;
}

const NUMBERS = Array.from({ length: CLUE_NUMBER_MAX - CLUE_NUMBER_MIN + 1 }, (_, i) => i + CLUE_NUMBER_MIN);

export function Game({ room, onError, onLeave }: GameProps) {
  const { t } = useI18n();
  const game = room.game!;
  const isSpy = room.you === game.spymaster;
  const over = game.phase === 'won' || game.phase === 'lost';
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const lastSeq = room.chat.at(-1)?.seq ?? 0;
  const unread = chatOpen ? 0 : room.chat.filter((l) => l.seq > seen && l.kind === 'msg' && l.from !== room.you).length;
  useEffect(() => {
    if (chatOpen) setSeen(lastSeq);
  }, [chatOpen, lastSeq]);

  const act = async (action: Parameters<typeof api.act>[0]) => {
    const r = await api.act(action);
    if (!r.ok) onError(r.error);
  };

  const myPick = game.picks[room.you];
  const onTile = (index: number) => {
    if (!game.legal.pick || game.revealed[index]) return;
    void act({ type: 'pick', pick: myPick === index ? null : index });
  };

  return (
    <div className="app" style={{ '--me': colorOf(room, room.you) } as CSSProperties}>
      <Header>
        <div className="room-meta">
          <span className="muted small">{t('room')}</span>
          <span className="code mono">{room.code}</span>
          <span className={isSpy ? 'chip spy' : 'chip'}>{isSpy ? t('spymaster') : t('operative')}</span>
        </div>
      </Header>
      {isSpy && !over && (
        <div className="spy-strip">
          <EyeIcon />
          <span>{t('spyStrip')}</span>
        </div>
      )}
      <div className="table">
        <div className="table-main">
          {over && <Result room={room} onLeave={onLeave} onError={onError} />}
          <Banner room={room} />
          {!over && <ClueBanner room={room} />}
          <Board room={room} onTile={onTile} />
          {isSpy && game.key && !over && <KeyLegend game={game} />}
          {game.phase === 'guess' && <AgreementBar room={room} act={act} />}
        </div>
        <aside className="table-side">
          {isSpy && game.legal.clue && <ClueForm game={game} act={act} />}
          <StatusCard room={room} />
          <div className={chatOpen ? 'chat-card card sheet open' : 'chat-card card sheet'}>
            <Chat
              room={room}
              onError={onError}
              round={!over}
              silent={isSpy && !over ? t('spySilent') : undefined}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </aside>
      </div>
      <button type="button" className="chat-fab" onClick={() => setChatOpen(true)}>
        <ChatIcon />
        <span>{t('chat')}</span>
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
    </div>
  );
}

/** Pauses and whose move it is, when that isn't obvious from the board. */
function Banner({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const game = room.game!;
  const online = (id: string) => room.players.find((p) => p.id === id)?.connected;
  if (game.phase === 'clue' && !online(game.spymaster))
    return <div className="banner warn">{t('pausedSpy', { name: nameOf(room, game.spymaster) })}</div>;
  if (game.phase === 'guess' && !game.operatives.some(online)) return <div className="banner warn">{t('pausedOps')}</div>;
  return null;
}

function ClueBanner({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const game = room.game!;
  const clue = game.clues.at(-1);
  if (game.phase === 'clue') {
    const isSpy = room.you === game.spymaster;
    return (
      <div className="clue-banner waiting">
        <span className="muted">{isSpy ? t('yourClue') : t('waitClue', { name: nameOf(room, game.spymaster) })}</span>
      </div>
    );
  }
  if (!clue) return null;
  return (
    <div className="clue-banner">
      <div className="clue-main">
        <span className="eyebrow">{t('clueFrom', { name: nameOf(room, game.spymaster) })}</span>
        <div className="clue-word">
          <span lang={game.lang === 'zh' ? 'zh' : undefined}>{clue.word}</span>
          <span className="clue-num mono">{clue.number}</span>
        </div>
      </div>
      <span className="spacer" />
      <div className="guesses">
        <span className="small">
          {t('guesses')}{' '}
          <span className="mono strong">
            {game.guesses} / {game.maxGuesses}
          </span>{' '}
          <span className="dim">{t('bonus', { n: clue.number })}</span>
        </span>
        <div className="pips" aria-hidden="true">
          {Array.from({ length: game.maxGuesses }, (_, i) => (
            <span key={i} className={i < game.guesses ? 'pip on' : i === game.maxGuesses - 1 ? 'pip bonus' : 'pip'} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Board({ room, onTile }: { room: RoomView; onTile: (index: number) => void }) {
  const { t } = useI18n();
  const game = room.game!;
  const over = game.phase === 'won' || game.phase === 'lost';
  const isSpy = room.you === game.spymaster;
  const picksAt = useMemo(() => {
    const at: Record<number, string[]> = {};
    for (const [id, p] of Object.entries(game.picks)) if (p !== 'stop') (at[p] ??= []).push(id);
    return at;
  }, [game.picks]);
  // Which clue found each revealed card.
  const foundBy = useMemo(() => {
    const by: Record<number, string> = {};
    for (const c of game.clues) for (const i of c.reveals) by[i] = c.word;
    return by;
  }, [game.clues]);
  const prevRevealed = useRef(game.revealed);
  const flipped = game.revealed.map((r, i) => r !== null && prevRevealed.current[i] === null);
  useEffect(() => {
    prevRevealed.current = game.revealed;
  });

  return (
    <div className={`board${game.lang === 'zh' ? ' zh' : ''}`} lang={game.lang === 'zh' ? 'zh' : undefined}>
      {game.words.map((word, i) => {
        const shown = game.revealed[i];
        const key: CardType | undefined = game.key?.[i];
        const pickers = picksAt[i] ?? [];
        const mine = game.picks[room.you] === i;
        const cls = ['tile'];
        if (shown) cls.push('revealed', `type-${shown}`);
        if (shown && isSpy && !over) cls.push('spy-dim');
        else if (key && (isSpy || over)) cls.push('keyed', `key-${key}`);
        if (over && !shown) cls.push('untouched');
        if (mine) cls.push('mine');
        if (flipped[i]) cls.push('flip');
        const type = shown ?? (isSpy || over ? key : undefined);
        const label = type ? `${word}, ${t(typeKey(type))}${shown ? '' : `, ${t('notRevealed')}`}` : word;
        return (
          <button
            key={i}
            type="button"
            className={cls.join(' ')}
            disabled={!game.legal.pick || shown !== null}
            aria-pressed={game.legal.pick && !shown ? mine : undefined}
            aria-label={label}
            onClick={() => onTile(i)}
          >
            {type && <TypeGlyph type={type} />}
            <span className="tile-word" style={{ '--chars': [...word].length } as CSSProperties}>
              {word}
            </span>
            {shown && foundBy[i] && shown === 'agent' && <span className="tile-sub">{foundBy[i]}</span>}
            {shown && shown !== 'agent' && <span className="tile-sub">{t(typeKey(shown))}</span>}
            {pickers.length > 0 && (
              <span className="marks">
                {pickers.map((id) => (
                  <span key={id} className="mark" style={{ background: colorOf(room, id) }} title={nameOf(room, id)}>
                    {initialOf(nameOf(room, id))}
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function KeyLegend({ game }: { game: GameView }) {
  const { t } = useI18n();
  const left = game.agentsTotal - game.agentsFound;
  return (
    <div className="key-legend">
      <span>
        <span className="sw key-agent" /> {t('legendAgent', { n: left })}
      </span>
      <span>
        <span className="sw key-rival" /> {t('legendRival')}
      </span>
      <span>
        <span className="sw key-bystander" /> {t('legendBystander')}
      </span>
      <span>
        <span className="sw key-assassin" /> {t('legendAssassin')}
      </span>
    </div>
  );
}

function AgreementBar({ room, act }: { room: RoomView; act: (a: Parameters<typeof api.act>[0]) => Promise<void> }) {
  const { t } = useI18n();
  const game = room.game!;
  const online = (id: string) => room.players.find((p) => p.id === id)?.connected ?? false;
  const voters = game.operatives.filter(online);
  const myPick = game.picks[room.you];
  const isCaptain = game.captain === room.you;

  // What's holding agreement up.
  let status: string;
  let tone = 'wait';
  const missing = voters.filter((id) => game.picks[id] === undefined);
  if (game.agreed !== null) {
    status = game.agreed === 'stop' ? t('agreedStop') : t('agreedWord', { word: pickText(t, room, game.agreed) });
    tone = 'ok';
  } else if (missing.length === voters.length) {
    status = t('pickPrompt');
  } else {
    const counts = new Map<Pick, number>();
    for (const id of voters) {
      const p = game.picks[id];
      if (p !== undefined) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const odd = voters.find((id) => game.picks[id] !== undefined && game.picks[id] !== top);
    status = odd
      ? t('notAgreed', { n, total: voters.length, word: pickText(t, room, top), who: nameOf(room, odd), other: pickText(t, room, game.picks[odd]) })
      : t('waitingFor', { names: missing.map((id) => nameOf(room, id)).join(', ') });
    tone = odd ? 'warn' : 'wait';
  }

  const confirmLabel =
    game.agreed === 'stop' ? t('confirmStop') : game.agreed !== null ? t('confirmReveal', { word: pickText(t, room, game.agreed) }) : t('confirm');

  return (
    <section className="agree" aria-labelledby="agree-title">
      <div className="agree-head">
        <h2 id="agree-title">{t('teamPicks')}</h2>
        <span className="muted small">{t('teamPicksNote')}</span>
        <span className="spacer" />
        {game.legal.pick && (
          <button
            type="button"
            className={myPick === 'stop' ? 'stop-btn on' : 'stop-btn'}
            aria-pressed={myPick === 'stop'}
            disabled={!game.legal.stop}
            title={game.legal.stop ? undefined : t('stopLater')}
            onClick={() => act({ type: 'pick', pick: myPick === 'stop' ? null : 'stop' })}
          >
            <span className="stop-sq" aria-hidden="true" />
            {t('pickStop')}
          </button>
        )}
      </div>
      <div className="picks">
        {game.operatives.map((id) => {
          const p = game.picks[id];
          const off = !online(id);
          const odd = game.agreed === null && p !== undefined && voters.some((v) => game.picks[v] !== undefined && game.picks[v] !== p);
          return (
            <div key={id} className={['pick-card', id === room.you && 'me', off && 'off', odd && 'odd'].filter(Boolean).join(' ')}>
              <span className="avatar-dot" style={{ background: colorOf(room, id) }} aria-hidden="true">
                {initialOf(nameOf(room, id))}
              </span>
              <div className="pick-text">
                <span className="muted small">{nameOf(room, id)}</span>
                <strong>{off ? t('offline') : pickText(t, room, p)}</strong>
              </div>
              {id === game.captain && <span className="captain-tag">{t('captain')}</span>}
            </div>
          );
        })}
      </div>
      <div className="agree-foot">
        <span className={`agree-status ${tone}`} role="status">
          {status}
        </span>
        <span className="spacer" />
        {isCaptain ? (
          <>
            <span className="muted small">{t('youCaptain')}</span>
            <button type="button" className="btn primary" disabled={!game.legal.confirm} onClick={() => act({ type: 'confirm' })}>
              {confirmLabel}
            </button>
          </>
        ) : (
          game.captain && <span className="muted small">{t('captainWill', { name: nameOf(room, game.captain) })}</span>
        )}
      </div>
    </section>
  );
}

function ClueForm({ game, act }: { game: GameView; act: (a: Parameters<typeof api.act>[0]) => Promise<void> }) {
  const { t } = useI18n();
  const [word, setWord] = useState('');
  const [number, setNumber] = useState(1);
  const check = checkClue(word, game.words, game.revealed.map((r) => r !== null), game.lang);
  const problem = word.trim() && !check.ok ? (check.error === 'CLUE_ON_BOARD' ? t('err.CLUE_ON_BOARD_WORD', { word: check.word ?? '' }) : errorText(t, check.error)) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!check.ok) return;
    await act({ type: 'clue', word: check.word, number });
  };

  return (
    <form className="card clue-form stack" onSubmit={submit}>
      <div className="row-between">
        <h2>{t('giveClue')}</h2>
        <span className="muted small">{t('usesToken', { n: game.tokens })}</span>
      </div>
      <div className="field">
        <label htmlFor="clue-word">{game.lang === 'zh' ? t('oneWordZh', { n: CLUE_MAX.zh }) : t('oneWord')}</label>
        <input
          id="clue-word"
          className="clue-input"
          lang={game.lang === 'zh' ? 'zh' : undefined}
          value={word}
          autoComplete="off"
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? 'clue-problem' : undefined}
          onChange={(e) => setWord(e.target.value)}
        />
        {problem && (
          <span id="clue-problem" className="field-error" role="alert">
            {problem}
          </span>
        )}
      </div>
      <div className="field">
        <span id="num-label" className="label">
          {t('howMany')}
        </span>
        <div className="nums" role="group" aria-labelledby="num-label">
          {NUMBERS.map((n) => (
            <button key={n} type="button" className="mono" aria-pressed={n === number} onClick={() => setNumber(n)}>
              {n}
            </button>
          ))}
        </div>
        <span className="muted small">{t('guessesAllowed', { n: number + 1, num: number })}</span>
      </div>
      <button className="btn primary big" disabled={!check.ok}>
        {t('giveClueBtn')}
      </button>
      <ul className="reminders">
        <li>{t('remind1')}</li>
        <li>{t('remind2')}</li>
        <li>{t('remind3')}</li>
      </ul>
    </form>
  );
}

function StatusCard({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const game = room.game!;
  const used = game.clues.length;
  const past = game.phase === 'guess' ? game.clues.slice(0, -1) : game.clues;
  return (
    <section className="card stack status">
      <div className="row-between">
        <span className="muted small">{t('clueN', { n: used, total: used + game.tokens })}</span>
        <span className="tag">{t(`level.${game.difficulty}`)}</span>
      </div>
      <div className="stat-row">
        <span>{t('agentsFound')}</span>
        <span className="mono strong">
          {game.agentsFound} / {game.agentsTotal}
        </span>
      </div>
      <div className="agent-pips" aria-hidden="true">
        {Array.from({ length: game.agentsTotal }, (_, i) => (
          <span key={i} className={i < game.agentsFound ? 'on' : ''} />
        ))}
      </div>
      <div className="stat-row">
        <span>{t('timerTokens')}</span>
        <span className="mono strong">{t('tokensLeft', { n: game.tokens })}</span>
      </div>
      <div className="tokens" aria-hidden="true">
        {Array.from({ length: used + game.tokens }, (_, i) => (
          <span key={i} className={i < game.tokens ? 'on' : ''} />
        ))}
      </div>
      {past.length > 0 && (
        <div className="past">
          <span className="muted small">{t('pastClues')}</span>
          {[...past].reverse().map((c, i) => (
            <div key={i} className="past-clue">
              <strong lang={game.lang === 'zh' ? 'zh' : undefined}>
                {c.word} · {c.number}
              </strong>
              {c.reveals.map((r) => {
                const type = game.revealed[r]!;
                return (
                  <span key={r} className={`word-chip type-${type}`}>
                    <TypeGlyph type={type} size={10} label={t(typeKey(type))} />
                    {game.words[r]}
                  </span>
                );
              })}
              {c.reveals.length === 0 && <span className="dim small">{t('noReveals')}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
