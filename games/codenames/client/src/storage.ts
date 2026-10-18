// localStorage can throw (private mode, blocked storage); the app must work without it.

export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Rejoin tokens, one per room code, so a refresh puts you back in your seat. */
export const tokens = {
  get(code: string): string | undefined {
    try {
      return JSON.parse(load('cn:tokens') ?? '{}')[code];
    } catch {
      return undefined;
    }
  },
  set(code: string, token: string | null) {
    let all: Record<string, string> = {};
    try {
      all = JSON.parse(load('cn:tokens') ?? '{}');
    } catch {
      // start fresh
    }
    if (token === null) delete all[code];
    else all[code] = token;
    save('cn:tokens', JSON.stringify(all));
  },
};
