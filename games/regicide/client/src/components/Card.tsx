import { isEnemyRank, isJester, rankOf, suitOf, type Card } from '@regicide/engine';
import { useI18n } from '../i18n';
import { GLYPH, cardText, isRed } from '../format';
import { CrownIcon, JesterIcon } from './Icons';

interface CardProps {
  card: Card;
  /** `lg`: the enemy. `md`: your hand. `sm`: the castle track. */
  size?: 'lg' | 'md' | 'sm';
  /** Highlight as picked: `play` (blue) or `discard` (orange). */
  picked?: 'play' | 'discard';
  onClick?: () => void;
  label?: string;
}

/** A face-up playing card. A button when `onClick` is set. */
export function PlayingCard({ card, size = 'md', picked, onClick, label }: CardProps) {
  const { t } = useI18n();
  const jester = isJester(card);
  const rank = rankOf(card);
  const glyph = jester ? '' : GLYPH[suitOf(card)!];
  const cls = [
    'pcard',
    `pcard-${size}`,
    jester ? 'pcard-jester' : isRed(card) ? 'pcard-red' : 'pcard-black',
    picked ? `picked picked-${picked}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const face = jester ? (
    <span className="pcard-jester-face">
      <JesterIcon size={size === 'sm' ? 18 : size === 'lg' ? 56 : 34} />
      {size !== 'sm' && <span className="pcard-jester-name">{t('jester').toUpperCase()}</span>}
    </span>
  ) : (
    <>
      <span className="pcard-corner">
        <span className="pcard-rank">{rank}</span>
        <span className="suit">{glyph}</span>
      </span>
      {size !== 'sm' && (
        <span className="pcard-center">
          {isEnemyRank(rank) && <CrownIcon size={size === 'lg' ? 54 : 26} strokeWidth={1.4} />}
          <span className="suit">{glyph}</span>
        </span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <span className={cls} role="img" aria-label={label ?? cardText(t, card)}>
        {face}
      </span>
    );
  }
  return (
    <button type="button" className={cls} aria-pressed={Boolean(picked)} aria-label={label ?? cardText(t, card)} onClick={onClick}>
      {face}
    </button>
  );
}

/** A small inline card, for lists like the discard pile. */
export function CardChip({ card }: { card: Card }) {
  const { t } = useI18n();
  return <span className={`card-chip ${isJester(card) ? 'pcard-jester' : isRed(card) ? 'pcard-red' : 'pcard-black'}`}>{cardText(t, card)}</span>;
}
