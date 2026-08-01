import { normalizeHex } from './faviconPaint';

// The brand default separator color. Its name is the canonical label (shown on
// the swatch tooltip); its hex is what every runtime path actually uses now that
// color travels as hex everywhere (URL, CSS, storage).
export const DEFAULT_COLOR = 'teal';

// Mirror of `config.colors.teal`. Kept as a literal (not a config import) so this
// client lib stays lean; `config-integrity.test.ts` asserts it never drifts.
export const DEFAULT_COLOR_HEX = '#14b8a6';

// The browser-chrome color (<meta name="theme-color">) per theme, mirroring the
// --background tokens in theme.css. The pre-paint bootstrap needs them as
// literals — no stylesheet is loaded yet, so it cannot read the token — and gets
// them from here through define:vars rather than hardcoding its own copies.
// config-integrity.test.ts asserts they still match theme.css.
export const THEME_COLOR = { dark: '#0e0e0f', light: '#e0e0e1' } as const;

// The accent to paint (logo, section rules, focus rings) for a chosen icon hex.
// A hex only gets to theme the whole site when it is a real palette color; any
// custom (color-wheel / URL) hex falls back to the brand default. `paletteHexes`
// is the set of the palette's hex values, which the caller already has (built
// from the swatch buttons / config). All values are normalized #rrggbb lowercase.
export const accentHex = (hex: string, paletteHexes: Set<string>): string =>
  paletteHexes.has(hex) ? hex : DEFAULT_COLOR_HEX;

// Validate a hex from anywhere untrusted (a data attribute, a URL query, storage),
// falling back to the brand default. Never inject an unvalidated string into a
// URL or an SVG, and never assert on normalizeHex's result:
// `normalizeHex(el.dataset.hex!)!` types a possible null as a string, which is
// exactly the bug this guards against.
export function safeHex(value: string): string {
  return normalizeHex(value) ?? DEFAULT_COLOR_HEX;
}

// A swatch button's color, read from its [data-hex] attribute. Swatches are
// rendered from the palette, but the palette is site-extendable data (a consuming
// site layers its own colors over config.json), so a typo'd hex must degrade to
// the brand default rather than poison the selection with null.
export function swatchHex(el: HTMLElement): string {
  return safeHex(el.dataset.hex ?? '');
}
