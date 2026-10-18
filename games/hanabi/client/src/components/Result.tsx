import { COLOURS, MAX_SCORE } from '@hanabi/engine';
import type { RoomView } from '@hanabi/server/protocol';
import { useI18n } from '../i18n';
import { cardName, colourName, nameOf, ratingKey } from '../format';
import { CardFace } from './Cards';

interface ResultProps {
  room: RoomView;
  onPlayAgain: () => void;
  onBack: () => void;
  onLeave: () => void;
}

export function Result({ room, onPlayAgain, onBack, onLeave }: ResultProps) {
  const { t } = useI18n();
  const game = room.game!;
  const boom = game.endReason === 'boom';
  const isHost = room.hostId === room.you;
  const built = COLOURS.reduce((sum, c) => sum + game.fireworks[c], 0);
  const hintsGiven = room.log.filter((e) => e.event.type === 'hinted').length;
  const kicker = boom ? t('boomKicker') : game.score === MAX_SCORE ? t('perfectKicker') : t('overKicker');

  return (
    <div className="overlay">
      <div className={boom ? 'result lost' : 'result won'} role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="result-head">
          <div className="result-score">
            <span className={boom ? 'mono score bad' : 'mono score'}>{game.score}</span>
            <span className="mono muted">/ {MAX_SCORE}</span>
          </div>
          <div className="result-text">
            <span className="kicker">{kicker}</span>
            <h1 id="result-title">{boom ? t('boomTitle') : t(ratingKey(game.score))}</h1>
            {boom && <p className="muted">{t('boomSub', { n: built })}</p>}
          </div>
        </div>

        <div className={boom ? 'result-fw dimmed' : 'result-fw'}>
          {COLOURS.map((c) => {
            const top = game.fireworks[c];
            const label = t('fireworkAria', { colour: colourName(t, c), n: top });
            return (
              <div key={c} className="fw">
                {top > 0 ? (
                  <CardFace colour={c} number={top as 1} size="md" label={label} />
                ) : (
                  <div className={`hcard hcard-md empty edge-${c}`} role="img" aria-label={label} />
                )}
              </div>
            );
          })}
        </div>

        <div className="stats">
          <div className="stat">
            <span className="muted small">{t('statMisplays')}</span>
            <strong className="mono">{game.misplays} / 3</strong>
          </div>
          <div className="stat">
            <span className="muted small">{t('statHints')}</span>
            <strong className="mono">{hintsGiven}</strong>
          </div>
          <div className="stat">
            <span className="muted small">{t('statTurns')}</span>
            <strong className="mono">{game.turn}</strong>
          </div>
        </div>

        <div className="stack">
          <h2>{t('finalHands')}</h2>
          <div className="final-hands">
            {game.players.map((p) => (
              <div key={p.id} className="final-hand">
                <span className="final-name">{nameOf(room, p.id)}</span>
                <span className="final-cards">
                  {p.hand.map((c) =>
                    c.colour && c.number ? (
                      <CardFace key={c.id} colour={c.colour} number={c.number} size="sm" label={cardName(t, { colour: c.colour, number: c.number })} />
                    ) : null,
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="result-actions">
          {isHost ? (
            <button type="button" className="btn primary grow" onClick={onPlayAgain}>
              {t('playAgain')}
            </button>
          ) : (
            <p className="muted small grow">{t('waitAgain', { name: nameOf(room, room.hostId) })}</p>
          )}
          <button type="button" className="btn outline" onClick={onBack}>
            {t('backToTable')}
          </button>
          <button type="button" className="btn outline" onClick={onLeave}>
            {t('leave')}
          </button>
        </div>
      </div>
    </div>
  );
}
