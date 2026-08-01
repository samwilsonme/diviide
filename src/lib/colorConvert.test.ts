import { describe, it, expect } from 'vitest';
import { hsvToHex, hslToHex, hexToHsv, hexToHsl, hexToRgb, parseColor } from './colorConvert';

describe('hsvToHex', () => {
  it('maps the primary/secondary corners', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000'); // red
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00'); // green
    expect(hsvToHex(240, 1, 1)).toBe('#0000ff'); // blue
    expect(hsvToHex(60, 1, 1)).toBe('#ffff00'); // yellow
  });

  it('maps brightness and saturation extremes', () => {
    expect(hsvToHex(0, 0, 1)).toBe('#ffffff'); // white (no saturation)
    expect(hsvToHex(200, 0.5, 0)).toBe('#000000'); // black (no value)
  });
});

describe('hexToHsv <-> hsvToHex round-trip', () => {
  // Sampled colors survive hex -> HSV -> hex exactly.
  for (const hex of ['#f43f5e', '#3b82f6', '#000000', '#ffffff', '#e11d48', '#8b5cf6']) {
    it(`round-trips ${hex}`, () => {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    });
  }
});

describe('hexToRgb / hexToHsl round-trips', () => {
  it('hexToRgb reads the channels', () => {
    expect(hexToRgb('#e11d48')).toEqual({ r: 225, g: 29, b: 72 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('hexToHsl -> hslToHex round-trips 8-bit colors', () => {
    for (const hex of ['#f43f5e', '#3b82f6', '#000000', '#ffffff', '#14b8a6']) {
      const { h, s, l } = hexToHsl(hex);
      expect(hslToHex(h, s, l)).toBe(hex);
    }
  });
});

describe('hslToHex', () => {
  it('maps the primary hues at 50% lightness', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#ff0000');
    expect(hslToHex(120, 1, 0.5)).toBe('#00ff00');
    expect(hslToHex(240, 1, 0.5)).toBe('#0000ff');
  });
});

describe('parseColor', () => {
  it('accepts hex, with or without # and 3-digit', () => {
    expect(parseColor('#e11d48')).toBe('#e11d48');
    expect(parseColor('e11d48')).toBe('#e11d48');
    expect(parseColor('  #ABC ')).toBe('#aabbcc');
  });

  it('accepts rgb() / rgba() (comma or space separated, alpha dropped)', () => {
    expect(parseColor('rgb(225, 29, 72)')).toBe('#e11d48');
    expect(parseColor('rgb(225 29 72)')).toBe('#e11d48');
    expect(parseColor('rgba(225,29,72,0.5)')).toBe('#e11d48');
  });

  it('accepts hsl() / hsla()', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toBe('#ff0000');
    expect(parseColor('hsl(240 100% 50%)')).toBe('#0000ff');
    expect(parseColor('hsl(120deg 100% 50%)')).toBe('#00ff00');
    expect(parseColor('hsla(120, 100%, 50%, 0.3)')).toBe('#00ff00');
  });

  it('returns null for junk', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor('not a color')).toBeNull();
    expect(parseColor('#12g')).toBeNull();
    expect(parseColor('rgb(1,2)')).toBeNull();
  });
});
