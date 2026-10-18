import type { RoomView } from '@bomb-busters/server/protocol';
import { useI18n } from '../i18n';
import { ACTION_EVENTS, nameOf, wireNumber } from '../format';
import { BombIcon, CheckIcon } from './Icons';

interface ResultProps {
  room: RoomView;
  onPlayAgain: () => void;
  onViewRacks: () => void;
  onLeave: () => void;
}

export function Result({ room, onPlayAgain, onViewRacks, onLeave }: ResultProps) {
  const { t } = useI18n();
  const game = room.game!;
  const won = game.phase === 'won';
  const isHost = room.hostId === room.you;

  const blueCut = Object.values(game.blueCut).reduce((a, b) => a + b, 0);
  const total = 48 + game.yellowTotal;
  const turns = room.log.filter((e) => ACTION_EVENTS.has(e.event.type)).length;

  let title = t('won');
  let subtitle = t('wonSub');
  if (game.lossReason === 'red-wire') {
    const boom = [...room.log].reverse().find((e) => e.event.type === 'redWireCut')?.event;
    title = t('lostRed');
    subtitle =
      boom && boom.type === 'redWireCut'
        ? t('lostRedSub', {
            who: nameOf(room, boom.player),
            target: nameOf(room, boom.target),
            n: wireNumber(game, boom.targetWireId),
          })
        : '';
  } else if (game.lossReason === 'detonator') {
    title = t('lostDet');
    subtitle = t('lostDetSub', { m: game.mistakes, allowed: game.mistakesAllowed });
  }

  return (
    <div className="overlay">
      <div className={won ? 'result won' : 'result lost'} role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="result-head">
          <div className="result-icon">
            {won ? <CheckIcon color="var(--blue)" /> : <BombIcon size={26} color="var(--red)" strokeWidth={2} />}
          </div>
          <div>
            <h1 id="result-title">{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="muted small">{t('statCut')}</span>
            <strong className="mono">
              {blueCut + game.yellowCut} / {total}
            </strong>
          </div>
          <div className="stat">
            <span className="muted small">{t('statMistakes')}</span>
            <strong className="mono">
              {game.mistakes} / {game.mistakesAllowed}
            </strong>
          </div>
          <div className="stat">
            <span className="muted small">{t('statTurns')}</span>
            <strong className="mono">{turns}</strong>
          </div>
        </div>
        <p className="small">{t('racksShown')}</p>
        <div className="result-actions">
          {isHost ? (
            <button type="button" className="btn primary grow" onClick={onPlayAgain}>
              {t('playAgain')}
            </button>
          ) : (
            <p className="muted small grow">{t('waitAgain', { name: nameOf(room, room.hostId) })}</p>
          )}
          <button type="button" className="btn outline" onClick={onViewRacks}>
            {t('viewRacks')}
          </button>
          <button type="button" className="btn outline" onClick={onLeave}>
            {t('leave')}
          </button>
        </div>
      </div>
    </div>
  );
}
