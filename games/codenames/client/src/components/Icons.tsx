import type { CardType } from '@codenames/engine';

export function LogoIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" rx="2" fill="var(--blue)" />
      <rect x="12" y="1" width="9" height="9" rx="2" fill="var(--paper)" />
      <rect x="1" y="12" width="9" height="9" rx="2" fill="var(--paper)" />
      <rect x="12" y="12" width="9" height="9" rx="2" fill="var(--blue)" />
    </svg>
  );
}

/** A shape per card type, so the board never relies on colour alone. */
export function TypeGlyph({ type, size = 14, label }: { type: CardType; size?: number; label?: string }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 14 14" {...a11y}>
      {type === 'agent' && <circle cx="7" cy="7" r="6" fill="currentColor" />}
      {type === 'rival' && <rect x="2.5" y="2.5" width="9" height="9" transform="rotate(45 7 7)" fill="currentColor" />}
      {type === 'bystander' && <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />}
      {type === 'assassin' && <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2 9l13-6-5 13-2-5-6-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 3.5h12v8H8l-3.5 3v-3H3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M1 9s3-5.5 8-5.5S17 9 17 9s-3 5.5-8 5.5S1 9 1 9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="9" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
