import { afterEach, describe, expect, it, vi } from 'vitest';
import { capitalize, isMac } from './utils';

// Node exposes a global `navigator` (24+), so unstubbed isMac assertions would
// depend on the machine running the tests. Always stub, always unstub.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capitalize', () => {
  it('uppercases only the first character', () => {
    expect(capitalize('rose')).toBe('Rose');
    expect(capitalize('light gray')).toBe('Light gray');
  });

  it('passes through the empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('isMac', () => {
  it('is false when navigator is undefined (build, early test env)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isMac()).toBe(false);
  });

  it('detects Mac and iOS platforms', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(isMac()).toBe(true);
    vi.stubGlobal('navigator', { platform: 'iPhone', userAgent: '' });
    expect(isMac()).toBe(true);
  });

  it('is false on Windows', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(isMac()).toBe(false);
  });

  it('falls back to the user agent when platform is empty', () => {
    vi.stubGlobal('navigator', { platform: '', userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0)' });
    expect(isMac()).toBe(true);
  });
});
