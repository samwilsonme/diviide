// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { STORAGE_KEYS, readString, writeString, readJSON, writeJSON } from './storage';

describe('storage keys', () => {
  it('keeps the persisted key names visitors already have data under', () => {
    // Not an identity assertion: these strings live in real browsers. Renaming one
    // silently abandons every visitor's saved color, recents, label and theme, with
    // no error anywhere — the page just comes up as if they had never been here.
    //
    // Nothing else pins the literals. config-integrity checks that the pre-paint
    // bootstrap reads the same key the runtime writes, but it builds both sides
    // from STORAGE_KEYS, so a rename passes there.
    expect(STORAGE_KEYS).toMatchObject({
      color: 'diviide-color',
      recent: 'diviide-recent',
      theme: 'diviide-theme',
      visited: 'diviide-visited',
      labelText: 'diviide-label-text',
      labelOptions: 'diviide-label-options',
      videoTime: 'diviide-video-time',
    });
  });
});

describe('storage helpers', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('readString returns fallback when absent, value when present', () => {
    expect(readString('k', 'fallback')).toBe('fallback');
    writeString('k', 'hello');
    expect(readString('k', 'fallback')).toBe('hello');
  });

  it('readJSON round-trips objects/arrays', () => {
    writeJSON('arr', [1, 2, 3]);
    expect(readJSON<number[]>('arr', [])).toEqual([1, 2, 3]);
  });

  it('readJSON falls back on corrupt JSON', () => {
    localStorage.setItem('bad', '{not json');
    expect(readJSON('bad', { ok: true })).toEqual({ ok: true });
  });

  it('does not throw when localStorage access throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeString('k', 'v')).not.toThrow();
    expect(readString('k', 'fb')).toBe('fb');
    expect(readJSON('k', 42)).toBe(42);
  });
});
