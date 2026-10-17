import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { BombIcon } from './Icons';

export function Header({ children }: { children?: ReactNode }) {
  const { lang, setLang } = useI18n();
  return (
    <header className="topbar">
      <div className="brand">
        <BombIcon color="var(--red)" />
        <span className="brand-name">BOMB BUSTERS</span>
        <span className="brand-sub">炸弹克星</span>
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
