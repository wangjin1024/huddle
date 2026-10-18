import type { Colour } from '@hanabi/engine';

/** Each colour has its own symbol, so colours never depend on hue alone. */
export const SYMBOL: Record<Colour, string> = {
  R: 'M10 1.5 18.5 10 10 18.5 1.5 10z',
  Y: 'M10 1.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L1.4 7.8l6-.7z',
  G: 'M10 2a8 8 0 1 0 .01 0z',
  B: 'M2.5 2.5h15v15h-15z',
  W: 'M10 1 12.2 7.8 19 10 12.2 12.2 10 19 7.8 12.2 1 10 7.8 7.8z',
};

/** Fills with currentColor unless `tinted`, which uses the colour itself. */
export function ColourSymbol({ colour, size = 16, tinted = false }: { colour: Colour; size?: number; tinted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={tinted ? `fill-${colour}` : undefined}>
      <path d={SYMBOL[colour]} fill={tinted ? undefined : 'currentColor'} />
    </svg>
  );
}

export function BurstIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v5" stroke="#e5484d" />
        <path d="M19.1 4.9l-3.5 3.5" stroke="#f5c84c" />
        <path d="M22 12h-5" stroke="#3fbf6f" />
        <path d="M19.1 19.1l-3.5-3.5" stroke="#4c8dff" />
        <path d="M12 22v-5" stroke="#eef1f5" />
        <path d="M4.9 19.1l3.5-3.5" stroke="#e5484d" />
        <path d="M2 12h5" stroke="#f5c84c" />
        <path d="M4.9 4.9l3.5 3.5" stroke="#3fbf6f" />
      </g>
      <circle cx="12" cy="12" r="2" fill="#eef1f5" />
    </svg>
  );
}

/** A misplay token: lit when used. */
export function SparkIcon({ size = 18, lit }: { size?: number; lit: boolean }) {
  const d = 'M10 1l2.2 5.4L18 5l-3.3 4.8L19 14l-5.8-.6L10 19l-3.2-5.6L1 14l4.3-4.2L2 5l5.8 1.4z';
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {lit ? <path d={d} fill="var(--red)" /> : <path d={d} fill="none" stroke="#3a4350" strokeWidth="1.6" strokeLinejoin="round" />}
    </svg>
  );
}
