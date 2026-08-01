import { afterEach } from 'vitest';

// jsdom 26+ requires a backing file for localStorage; provide a simple
// in-memory implementation so tests get deterministic, isolated storage.
// Applied only to jsdom suites (node-environment suites have no window).
function createStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    removeItem(key: string) {
      delete store[key];
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
  } as Storage;
}

if (typeof window !== 'undefined') {
  const storageMock = createStorageMock();
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    writable: true,
    configurable: true,
  });

  afterEach(() => {
    window.localStorage.clear();
  });
}
