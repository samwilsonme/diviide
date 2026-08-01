// The favicon paint primitives: hex validation, the shape-template recolor, and
// the coordinate rounding every consumer applies before a shape becomes a mask
// or a favicon. Three very different runtimes need this exact logic, and a
// cold-loaded bookmark, a live re-tint, and the E2E verifier's expected value
// must agree byte for byte:
//
//   - the app (favicon.ts, iconTemplates.ts) via Vite,
//   - scripts/verify-favicons.mjs under plain Node, which rebuilds the data URI
//     the app should have written into Chrome's favicon database,
//   - and the pre-paint bootstrap, which is an inline <script> and so is the one
//     copy that genuinely cannot import (see PrePaintBootstrap.astro; its output
//     is compared against a reference painter in prePaintBootstrap.dom.test.ts).
//
// THIS FILE MUST HAVE NO IMPORTS. Node 24 can load a `.ts` module directly via
// type stripping, but it resolves neither extensionless specifiers nor Vite's
// import.meta.glob — so a single import here would break the plain-Node verifier
// at a distance, and it would fail as a confusing module-resolution error rather
// than anything that names this rule. faviconPaint.test.ts asserts the file
// stays import-free.

// A hex color, with or without a leading '#'. Kept identical to the copy in the
// inline bootstrap.
export const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Normalize to lowercase #rrggbb (expanding #rgb), or null when not a hex. This
// also sanitizes untrusted URL input before it is injected into the SVG string.
export function normalizeHex(value: string): string | null {
  const m = HEX_RE.exec(value);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return `#${h}`;
}

// Paint a color-agnostic shape template with a hex. `black` is the placeholder
// every colorable source SVG carries (config-integrity.test.ts enforces that).
export function faviconSvg(template: string, hex: string): string {
  return template.replace(/(stroke|fill)="black"/g, `$1="${hex}"`);
}

// Round high-precision coordinates (many exports carry 3-6 decimals) to 2
// decimals: invisible at the 24px tile / 16px favicon render sizes, and it cuts
// the doubled inline shape payload (template map + tile masks) by ~40% gzipped.
// Every consumer pipes templates through here, so cold-load and live re-tint
// favicons stay byte-identical.
export function roundIconSvg(raw: string): string {
  return raw.replace(/\d+\.\d{3,}/g, (m) => String(+(+m).toFixed(2)));
}
