export function CrownIcon({ size = 26, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function JesterIcon({ size = 34, color = 'var(--gold)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M4 9c2 0 4-3 4-6 1.5 3 2.5 5 4 6 1.5-1 2.5-3 4-6 0 3 2 6 4 6l-3 9H7z" />
      <circle cx="4" cy="8" r="1.2" />
      <circle cx="20" cy="8" r="1.2" />
      <circle cx="12" cy="3" r="1" />
    </svg>
  );
}

export function SkullIcon({ size = 26, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z" />
      <circle cx="9" cy="11" r="1.5" />
      <circle cx="15" cy="11" r="1.5" />
      <path d="M10 20v-2M14 20v-2" />
    </svg>
  );
}
