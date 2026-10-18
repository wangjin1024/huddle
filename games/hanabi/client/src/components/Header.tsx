import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { BurstIcon } from './Icons';

export function Header({ children }: { children?: ReactNode }) {
  const { lang, setLang } = useI18n();
  return (
    <header className="topbar">
      <div className="brand">
        <BurstIcon />
        <span className="brand-name">HANABI</span>
        <span className="brand-sub">花火</span>
      </div>
      {children}
      <div className="spacer" />
      <div className="lang" role="group" aria-label="Language">
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
          EN
        </button>
        <button type="button" aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>
          中文
        </button>
      </div>
    </header>
  );
}
