import { useCallback, useEffect, useState } from 'react';
import { errorText, useI18n } from './i18n';
import { api, useRoom } from './net';
import { BASE, codeFromPath, roomPath } from './paths';
import { tokens } from './storage';
import { Game } from './components/Game';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';

export function App() {
  const { t } = useI18n();
  const { view, setView, connected } = useRoom();
  const [code, setCode] = useState(codeFromPath);
  const [rejoining, setRejoining] = useState(() => Boolean(code && tokens.get(code)));
  const [toast, setToast] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string>();

  const navigate = useCallback((next?: string) => {
    history.pushState(null, '', next ? roomPath(next) : BASE);
    setCode(next);
  }, []);

  useEffect(() => {
    const onPop = () => setCode(codeFromPath());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  // Arriving on a room link we already have a seat in: take the seat back.
  useEffect(() => {
    const token = code && tokens.get(code);
    if (!code || !token || view?.code === code) return;
    setRejoining(true);
    void api.join(code, undefined, token).then((r) => {
      setRejoining(false);
      if (!r.ok) {
        tokens.set(code, null);
        if (r.error === 'ROOM_NOT_FOUND') setHomeError(errorText(t, r.error));
      }
    });
  }, [code]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const onError = useCallback((c: string) => setToast(errorText(t, c)), [t]);
  const leave = useCallback(async () => {
    await api.leave();
    setView(null);
    navigate();
  }, [navigate, setView]);

  const inRoom = view && code && view.code === code;
  let screen;
  if (inRoom) {
    screen = view.game ? (
      <Game room={view} onError={onError} onLeave={leave} />
    ) : (
      <Lobby room={view} onError={onError} onLeave={leave} />
    );
  } else if (rejoining) {
    screen = <p className="center muted pad">{t('connecting')}</p>;
  } else {
    screen = (
      <Home
        key={code ?? 'home'}
        inviteCode={code}
        initialError={homeError}
        onJoined={(c) => {
          setHomeError(undefined);
          if (c !== code) navigate(c);
        }}
        onBack={() => navigate()}
      />
    );
  }

  return (
    <>
      {screen}
      {!connected && !rejoining && (
        <div className="net-banner" role="status">
          {t('connectionLost')}
        </div>
      )}
      {toast && (
        <div className="toast" role="alert">
          {toast}
        </div>
      )}
    </>
  );
}
