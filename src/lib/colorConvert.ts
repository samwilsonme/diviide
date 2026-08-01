// Color math for the Advanced picker. Pure and DOM-free (node-testable): the
// wheel picks in HSV, but the app stores 6-digit hex, so this converts between
// them and parses a pasted color value (hex / rgb / hsl) down to #rrggbb.
//
// normalizeHex comes straight from faviconPaint, not from favicon.ts's re-export
// of it. Both give the same function, but favicon.ts also pulls in bookmarkUrl,
// colors and svgDataUri and declares Window globals — none of which color math
// has any business depending on. faviconPaint is the import-free primitive module
// (see the rule at the top of it), so this is the leaf of that graph.
import { normalizeHex } from './faviconPaint';

// The RGB channels for a hue sextant, given the chroma `c` and second component
// `x` (shared by the HSV and HSL conversions, which only differ in how c/x/m are
// derived). Returns channels in [0,1] before the `m` offset.
function huePart(h: number, c: number, x: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  if (hh < 60) return [c, x, 0];
  if (hh < 120) return [x, c, 0];
  if (hh < 180) return [0, c, x];
  if (hh < 240) return [0, x, c];
  if (hh < 300) return [x, 0, c];
  return [c, 0, x];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Hex -> {r, g, b} (0-255). Invalid input resolves to black.
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex) ?? '#000000';
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

// h in [0,360), s and v in [0,1].
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = huePart(h, c, x);
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// h in [0,360), s and l in [0,1].
export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = huePart(h, c, x);
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// Hue plus channel extremes for a hex color (shared by the HSV and HSL
// conversions, which only differ in how they derive s and v/l from these).
// h in [0,360); max, min, and delta d in [0,1]. Invalid input resolves to black.
function hexToHue(hex: string): { h: number; max: number; min: number; d: number } {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, max, min, d };
}

// Hex -> HSV (h in [0,360), s and v in [0,1]). Invalid input resolves to black.
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { h, max, d } = hexToHue(hex);
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

// Hex -> HSL (h in [0,360), s and l in [0,1]). Invalid input resolves to black.
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { h, max, min, d } = hexToHue(hex);
  const l = (max + min) / 2;
  return { h, s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
}

// Parse a pasted color value to #rrggbb, or null if it isn't one we understand.
// Accepts hex (#rgb / #rrggbb, with or without #), rgb()/rgba(), and hsl()/hsla()
// — alpha is dropped (the app is opaque 6-digit hex). Named CSS colors are out
// of scope (would need the browser); hex + rgb + hsl cover the paste cases.
export function parseColor(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  const hex = normalizeHex(s);
  if (hex) return hex;

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*[\d.%]+\s*)?\)$/i.exec(
    s
  );
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);

  const hsl =
    /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*[\d.%]+\s*)?\)$/i.exec(
      s
    );
  if (hsl) return hslToHex(+hsl[1], +hsl[2] / 100, +hsl[3] / 100);

  return null;
}
