import { useState, type FormEvent } from 'react';
import { errorText, useI18n } from '../i18n';
import { api } from '../net';
import { load, save } from '../storage';
import { Header } from './Header';

interface HomeProps {
  /** Arrived through a room link: only ask for a name. */
  inviteCode?: string;
  initialError?: string;
  onJoined: (code: string) => void;
  onBack: () => void;
}

export function Home({ inviteCode, initialError, onJoined, onBack }: HomeProps) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(() => load('cn:name') ?? '');
  const [code, setCode] = useState(inviteCode ?? '');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => ReturnType<typeof api.create>) {
    setBusy(true);
    setError(undefined);
    save('cn:name', name.trim());
    const result = await fn();
    setBusy(false);
    if (result.ok) onJoined(result.code);
    else setError(errorText(t, result.error));
  }

  const create = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.create(name, lang));
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.join(code.trim().toUpperCase(), name));
  };

  const nameField = (
    <div className="field">
      <label htmlFor="name">{t('yourName')}</label>
      <input
        id="name"
        value={name}
        maxLength={16}
        autoComplete="nickname"
        placeholder={t('namePlaceholder')}
        onChange={(e) => setName(e.target.value)}
      />
    </div>
  );

  return (
    <div className="app">
      <Header />
      <main className="home">
        <a className="back-link" href="/">
          ← {t('allGames')}
        </a>
        <h1>CODENAMES</h1>
        <p className="muted">{t('tagline')}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {inviteCode ? (
          <form className="card stack" onSubmit={join}>
            <h2>{t('joinRoom', { code: inviteCode })}</h2>
            {nameField}
            <button className="btn primary" disabled={busy}>
              {t('join')}
            </button>
            <button type="button" className="btn link" onClick={onBack}>
              {t('backHome')}
            </button>
          </form>
        ) : (
          <>
            <form className="card stack" onSubmit={create}>
              {nameField}
              <button className="btn primary" disabled={busy}>
                {t('createRoom')}
              </button>
            </form>
            <form className="card stack" onSubmit={join}>
              <h2>{t('joinTitle')}</h2>
              <div className="field">
                <label htmlFor="code">{t('roomCode')}</label>
                <input
                  id="code"
                  className="mono"
                  value={code}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="Q4MZ"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <button className="btn outline" disabled={busy || code.trim().length !== 4}>
                {t('join')}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
