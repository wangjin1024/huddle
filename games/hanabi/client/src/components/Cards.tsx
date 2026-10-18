import { COLOURS, NUMBERS, type CardView, type Colour, type Num } from '@hanabi/engine';
import { useI18n } from '../i18n';
import { possible } from '../format';
import { ColourSymbol } from './Icons';

type Size = 'sm' | 'md' | 'lg';

interface FaceProps {
  colour: Colour;
  number: Num;
  size?: Size;
  label: string;
  /** Outlined: named by the hint being composed, or by the latest hint. */
  ring?: 'touch' | 'flash';
  isNew?: boolean;
  onClick?: () => void;
}

/** A face-up card: a teammate's, a firework top, or a revealed card. */
export function CardFace({ colour, number, size = 'md', label, ring, isNew, onClick }: FaceProps) {
  const { t } = useI18n();
  const cls = `hcard hcard-${size} face-${colour}${ring ? ` ring-${ring}` : ''}`;
  const body = (
    <>
      <span className="hcard-num">{number}</span>
      <span className="hcard-sym">
        <ColourSymbol colour={colour} size={size === 'lg' ? 26 : size === 'md' ? 20 : 12} />
      </span>
      {isNew && <span className="new-tag">{t('newTag')}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} aria-label={label} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls} role="img" aria-label={label}>
      {body}
    </div>
  );
}

/** Small marks for what a card can still be: a known value, or the values not ruled out. */
export function KnowledgeStrip({ card }: { card: CardView }) {
  const k = card.knowledge;
  const { colours, numbers } = possible(k);
  const showColours = colours.length < COLOURS.length;
  const showNumbers = numbers.length < NUMBERS.length;
  return (
    <span className="kstrip" aria-hidden="true">
      {showColours && colours.map((c) => <ColourSymbol key={c} colour={c} size={9} tinted />)}
      {showNumbers && <span className={k.number ? 'k-num known' : 'k-num'}>{numbers.join('')}</span>}
      {!showColours && !showNumbers && <span className="k-num">?</span>}
    </span>
  );
}

interface BackProps {
  card: CardView;
  label: string;
  selected?: boolean;
  ring?: 'flash';
  isNew?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** One of your own cards: you see only what hints have said about it. */
export function CardBack({ card, label, selected, ring, isNew, disabled, onClick }: BackProps) {
  const { t } = useI18n();
  const k = card.knowledge;
  const { colours, numbers } = possible(k);
  const cls = ['hback', k.colour ? `edge-${k.colour}` : '', selected ? 'selected' : '', ring ? `ring-${ring}` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} aria-label={label} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      <span className="hback-top">
        <span className={k.number ? 'hback-num known' : 'hback-num'}>{k.number ?? '?'}</span>
        {k.colour && <ColourSymbol colour={k.colour} size={20} tinted />}
      </span>
      <span className="hback-poss">
        <span className="hback-cols">
          {colours.map((c) => (
            <ColourSymbol key={c} colour={c} size={10} tinted />
          ))}
        </span>
        {!k.number && <span className="mono hback-nums">{numbers.join('')}</span>}
      </span>
      {isNew && <span className="new-tag">{t('newTag')}</span>}
    </button>
  );
}
