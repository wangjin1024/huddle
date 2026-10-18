import type { RoomView } from '@codenames/server/protocol';
import { useI18n } from '../i18n';
import { api } from '../net';
import { nameOf } from '../format';

interface ResultProps {
  room: RoomView;
  onLeave: () => void;
  onError: (code: string) => void;
}

/** Docked above the board, so everyone can study the full key underneath. */
export function Result({ room, onLeave, onError }: ResultProps) {
  const { t } = useI18n();
  const game = room.game!;
  const won = game.phase === 'won';
  const isHost = room.hostId === room.you;
  const misses = game.clues.flatMap((c) => c.reveals).filter((i) => game.revealed[i] !== 'agent').length;
  const seat = room.players.findIndex((p) => p.id === game.spymaster);
  const next = room.players[(seat + 1) % room.players.length];

  const again = async () => {
    const r = await api.playAgain();
    if (!r.ok) onError(r.error);
  };

  return (
    <section className={won ? 'result won' : 'result lost'} aria-labelledby="result-title">
      <div className="result-text">
        <span className="eyebrow">
          {won ? t('wonEyebrow') : t('lostEyebrow')} · {t(`level.${game.difficulty}`)}
        </span>
        <h1 id="result-title">{won ? t('won') : game.lossReason === 'assassin' ? t('lostAssassin') : t('lostTime')}</h1>
        <p className="muted">
          {won ? t('wonSub', { n: game.tokens, name: nameOf(room, game.spymaster) }) : t('lostSub', { n: game.agentsFound })}
        </p>
      </div>
      <dl className="result-stats">
        <div>
          <dt>{t('statAgents')}</dt>
          <dd className="mono">
            {game.agentsFound}/{game.agentsTotal}
          </dd>
        </div>
        <div>
          <dt>{t('statTokens')}</dt>
          <dd className="mono gold">{game.tokens}</dd>
        </div>
        <div>
          <dt>{t('statClues')}</dt>
          <dd className="mono">{game.clues.length}</dd>
        </div>
        <div>
          <dt>{t('statMisses')}</dt>
          <dd className="mono">{misses}</dd>
        </div>
      </dl>
      <div className="result-actions">
        {isHost ? (
          <button type="button" className="btn primary big" onClick={again}>
            {t('playAgain')}
          </button>
        ) : (
          <p className="muted small">{t('waitAgain', { name: nameOf(room, room.hostId) })}</p>
        )}
        {next && <span className="muted small">{t('nextSpy', { name: next.name })}</span>}
        <button type="button" className="btn link" onClick={onLeave}>
          {t('leave')}
        </button>
      </div>
    </section>
  );
}
