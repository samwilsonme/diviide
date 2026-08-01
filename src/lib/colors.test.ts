import { describe, it, expect } from 'vitest';
import { accentHex, DEFAULT_COLOR_HEX } from './colors';

describe('accentHex', () => {
  // A small palette: teal (default/brand) and blue (a normal preset). Custom
  // colors are simply hexes not in this set.
  const palette = new Set(['#14b8a6', '#3b82f6']);

  it('keeps a palette color as its own accent', () => {
    expect(accentHex('#3b82f6', palette)).toBe('#3b82f6');
    expect(accentHex('#14b8a6', palette)).toBe('#14b8a6');
  });

  it('maps any color not in the palette (a custom/URL hex) to the brand default', () => {
    expect(accentHex('#e11d48', palette)).toBe(DEFAULT_COLOR_HEX);
    expect(accentHex('#123456', palette)).toBe(DEFAULT_COLOR_HEX);
  });
});
