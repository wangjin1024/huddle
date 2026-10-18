import { ENEMY_RANKS, rankOf, suitOf } from '@regicide/engine';
import type { RoomView } from '@regicide/server/protocol';
import { useI18n } from '../i18n';
import { GLYPH, TURN_EVENTS, enemyName, nameOf } from '../format';
import { CrownIcon, SkullIcon } from './Icons';

interface ResultProps {
  room: RoomView;
  onPlayAgain: () => void;
  onBack: () => void;
  onLeave: () => void;
}

export function Result({ room, onPlayAgain, onBack, onLeave }: ResultProps) {
  const { t } = useI18n();
  const game = room.game!;
  const won = game.phase === 'won';
  const isHost = room.hostId === room.you;
  const exact = game.defeated.filter((d) => d.exact).length;
  const jestersUsed = room.log.filter((e) => e.event.type === 'jester').length;
  const turns = room.log.filter((e) => TURN_EVENTS.has(e.event.type)).length;

  let subtitle = t('wonSub');
  if (!won) {
    const lost = [...room.log].reverse().find((e) => e.event.type === 'gameLost')?.event;
    const who = lost && lost.type === 'gameLost' ? nameOf(room, lost.player) : '?';
    const enemy = enemyName(t, game.enemy.card);
    subtitle = game.lossReason === 'emptyHand' ? t('lostEmpty', { who, enemy }) : t('lostAttack', { who, enemy });
  }

  // All 12 castle slots: defeated in order, then the enemy that won (if any), then the rest face down.
  const remaining = ENEMY_RANKS.flatMap((r) => Array<string>(game.castleLeft[r]).fill(r));
  return (
    <div className="overlay">
      <div className={won ? 'result won' : 'result lost'} role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="result-head">
          <div className="result-icon">{won ? <CrownIcon color="var(--gold)" /> : <SkullIcon color="var(--red)" />}</div>
          <div>
            <h1 id="result-title">{won ? t('won') : t('lost')}</h1>
            <p className="muted">{subtitle}</p>
          </div>
        </div>
        <div className="result-castle" aria-hidden="true">
          {game.defeated.map((d) => (
            <span key={d.card} className={d.exact ? 'slot exact' : 'slot over'}>
              <span className="mono">{rankOf(d.card)}</span>
              <span className="suit">{GLYPH[suitOf(d.card)!]}</span>
            </span>
          ))}
          {!won && (
            <span className="slot winner">
              <span className="mono">{rankOf(game.enemy.card)}</span>
              <span className="suit">{GLYPH[suitOf(game.enemy.card)!]}</span>
            </span>
          )}
          {remaining.map((r, i) => (
            <span key={i} className="slot hidden">
              <span className="mono">{r}</span>
            </span>
          ))}
        </div>
        <div className="stats">
          <div className="stat">
            <span className="muted small">{t('statDefeated')}</span>
            <strong className="mono">{game.defeated.length} / 12</strong>
          </div>
          <div className="stat">
            <span className="muted small">{t('statExact')}</span>
            <strong className="mono gold">{exact}</strong>
          </div>
          <div className="stat">
            <span className="muted small">{game.jesters > 0 ? t('statJesters') : t('statTurns')}</span>
            <strong className="mono">{game.jesters > 0 ? `${jestersUsed} / ${game.jesters}` : turns}</strong>
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
