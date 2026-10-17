import type { Guess, WireView } from '@bomb-busters/engine';
import { useI18n } from '../i18n';
import { BombIcon } from './Icons';

interface WireProps {
  wire: WireView;
  number: number;
  size: 'sm' | 'lg';
  label: string;
  selected?: boolean;
  /** Highlighted as something you can tap right now (setup reveal, own-wire choice). */
  pickable?: boolean;
  onPick?: () => void;
}

/** One wire tile. Face-up when its color is known to this viewer, striped face-down otherwise. */
export function Wire({ wire, number, size, label, selected, pickable, onPick }: WireProps) {
  const { t } = useI18n();
  const known = wire.color !== undefined;
  const cls = [
    'wire',
    `wire-${size}`,
    known ? `face wire-${wire.color}` : 'hidden',
    wire.cut && 'cut',
    selected && 'selected',
    pickable && 'pickable',
  ]
    .filter(Boolean)
    .join(' ');

  const face = known && (
    <>
      <span className="stripe" />
      {wire.color === 'blue' && <span className="num">{wire.value}</span>}
      {wire.color === 'yellow' && (
        <>
          <span className="num">{t('yellowShort')}</span>
          <span className="sub">{wire.value!.toFixed(1)}</span>
        </>
      )}
      {wire.color === 'red' && (
        <>
          <BombIcon size={size === 'lg' ? 24 : 16} color="var(--red)" strokeWidth={2.2} />
          <span className="sub">{wire.value!.toFixed(1)}</span>
        </>
      )}
      {wire.cut && <span className="slash" />}
    </>
  );

  return (
    <div className={`wire-slot wire-slot-${size}`}>
      {onPick ? (
        <button type="button" className={cls} aria-label={label} aria-pressed={selected} onClick={onPick}>
          {face}
        </button>
      ) : (
        <div className={cls} role="img" aria-label={label}>
          {face}
        </div>
      )}
      <Marker value={wire.marker} />
      {size === 'sm' && <span className="pos">#{number}</span>}
    </div>
  );
}

function Marker({ value }: { value?: Guess }) {
  const { t } = useI18n();
  return (
    <span className="marker-row">
      {value !== undefined && (
        <span className={value === 'yellow' ? 'marker marker-yellow' : 'marker'}>
          {value === 'yellow' ? t('yellowShort') : value}
        </span>
      )}
    </span>
  );
}
