// Centralized localStorage keys + safe accessors.
// All access is wrapped so corrupted data or a blocked/full localStorage
// (private mode, sandboxed iframes) can never crash the app.

export const STORAGE_KEYS = {
  color: 'diviide-color',
  recent: 'diviide-recent',
  visited: 'diviide-visited',
  labelText: 'diviide-label-text',
  labelOptions: 'diviide-label-options',
  videoTime: 'diviide-video-time',
  // Also read pre-paint by the inline bootstrap, which cannot import this
  // module and hardcodes the literal; config-integrity.test.ts pins the two
  // together (the same arrangement as `color` above).
  theme: 'diviide-theme',
} as const;

export function readString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}
