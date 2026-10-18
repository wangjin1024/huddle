/** '/hanabi/' (Vite `base`). Every in-app URL lives under it. */
export const BASE = import.meta.env.BASE_URL;

export const roomPath = (code: string) => `${BASE}r/${code}`;

/** The room code in a /hanabi/r/CODE URL, if any. */
export const codeFromPath = () =>
  location.pathname.startsWith(BASE)
    ? /^r\/([A-Za-z0-9]{4})\/?$/.exec(location.pathname.slice(BASE.length))?.[1]?.toUpperCase()
    : undefined;
