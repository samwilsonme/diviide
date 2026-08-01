// Optional label decoration: pad a bookmark label with a fill character, align
// it, wrap it in end-caps, and hold it to a target character count so it stands
// out as a heading inside a bookmark folder (e.g. `<----- Work ----->`).
//
// This is the one place the decoration lives. `dragLabel()` in src/tool/main.ts
// runs the raw label through formatLabel(), and every drag source reads that
// result (see applyLabels + startSeparatorDrag). Framework- and dependency-free.

export type LabelAlign = 'left' | 'center' | 'right';

export interface LabelFormatOptions {
  align: LabelAlign;
  /** Fill value: 'none' (no padding) or the fill glyph itself. */
  fill: string;
  /** Leading end-cap, '' for none. */
  prepend: string;
  /** Trailing end-cap, '' for none. */
  append: string;
  /** Target total count, including label, fill, and end-caps. */
  length: number;
}

// Fill choices for the dropdown: [value, label]. The label is the bare glyph,
// matching the Prepend/Append dropdowns; only 'none' needs a named label.
// There is no 'space' fill: Chrome collapses/strips whitespace in bookmark
// titles, so a run of spaces vanishes on drop (the single separating space
// inside `- x -` still survives).
export const FILL_OPTIONS: ReadonlyArray<readonly [value: string, label: string]> = [
  ['none', 'None'],
  ['-', '-'],
  ['_', '_'],
  ['=', '='],
  ['█', '█'],
  ['■', '■'],
  ['|', '|'],
  ['~', '~'],
  ['≈', '≈'],
  ['.', '.'],
  [':', ':'],
  ['*', '*'],
] as const;

export const ALIGN_OPTIONS: ReadonlyArray<readonly [value: LabelAlign, label: string]> = [
  ['left', 'Left'],
  ['center', 'Center'],
  ['right', 'Right'],
] as const;

// End-caps. First entry is "none" (''). MIRROR_CAP pairs an opening cap with its
// closing partner, so picking a prepend can auto-suggest the matching append.
export const PREPEND_OPTIONS: readonly string[] = ['', '<', '(', '[', '{'];
export const APPEND_OPTIONS: readonly string[] = ['', '>', ')', ']', '}'];
export const MIRROR_CAP: Readonly<Record<string, string>> = {
  '<': '>',
  '(': ')',
  '[': ']',
  '{': '}',
};

export const LENGTH_MIN = 10;
export const LENGTH_MAX = 60;
export const LENGTH_DEFAULT = 20;

// The one place a fill length is bounded, so the stored blob, the range input and
// the formatter can never disagree about what a valid length is. It used to be
// two identical expressions — this function in labels.ts and an inline copy in
// formatLabel below — under a comment in labels.ts claiming to be the only one.
export function clampLength(value: number): number {
  return Math.max(LENGTH_MIN, Math.min(LENGTH_MAX, Math.round(value)));
}

// Chrome truncates bookmark titles at fixed widths (from the Chromium source):
// the bookmarks-bar button at kMaxButtonWidth = 150px, a folder drop-down menu
// at kMaxMenuWidth = 400px. These are the text budgets after the favicon +
// padding those caps include (approximate). The preview measures the label in the
// OS UI font and reports which limit it clears. Module-local: the public surface
// is labelFitLevel() / describeLabelFit(), so callers ask "which tier?" rather
// than comparing against the raw pixel budgets themselves.
const BAR_TEXT_PX = 120;
const FOLDER_TEXT_PX = 360;

// The canvas font the fit meter measures candidate labels in. Chrome draws
// bookmark titles in the OS UI font, so measuring in anything else would report
// the wrong truncation tier against the budgets above.
//
// LabelSection's preview renders the same size and family, but spells them as
// Tailwind classes (`text-xs` and an arbitrary `[font-family:…]`) rather than
// importing this: Tailwind's scanner only emits a class it can see as a literal.
// config-integrity.test.ts holds the two spellings together.
export const MEASURE_FONT = '12px system-ui, sans-serif';

export type LabelFitLevel = 'fits' | 'bar' | 'folder';

// Which truncation tier a measured width falls into (for coloring the meter).
export function labelFitLevel(px: number): LabelFitLevel {
  if (px <= BAR_TEXT_PX) return 'fits';
  if (px <= FOLDER_TEXT_PX) return 'bar';
  return 'folder';
}

// Truncation warning per tier; '' for a label that fits within the bookmarks
// bar cap (so no news is shown for a label that fits everywhere).
export const FIT_DESCRIPTIONS: Readonly<Record<LabelFitLevel, string>> = {
  fits: '',
  bar: 'truncates in bookmarks bar',
  folder: 'truncates in folder',
};

// Convenience for callers that haven't already computed the tier.
export function describeLabelFit(px: number): string {
  return FIT_DESCRIPTIONS[labelFitLevel(px)];
}

export const DEFAULT_LABEL_OPTIONS: LabelFormatOptions = {
  align: 'center',
  fill: 'none',
  prepend: '',
  append: '',
  length: LENGTH_DEFAULT,
};

// One-click looks for the preset chips. Each fully specifies the options so
// switching presets is a clean reset to that style (label text is untouched).
// (No "Plain" preset — Reset already restores the plain defaults.)
export const LABEL_PRESETS: ReadonlyArray<{ name: string; options: LabelFormatOptions }> = [
  {
    name: 'Dashes',
    options: { align: 'center', fill: '-', prepend: '<', append: '>', length: 20 },
  },
  {
    name: 'Brackets',
    options: { align: 'center', fill: 'none', prepend: '[', append: ']', length: 20 },
  },
  { name: 'Blocks', options: { align: 'center', fill: '█', prepend: '', append: '', length: 20 } },
  { name: 'Dots', options: { align: 'center', fill: '.', prepend: '', append: '', length: 20 } },
];

function fillGlyph(fill: string): string {
  return fill === 'none' ? '' : fill;
}

// Character count by CODE POINT, not UTF-16 code unit. An emoji is one character
// to the reader and one glyph in a bookmark title, but String.length counts it as
// two (or more) — which padded any emoji label short and, worse, disagreed with
// the fill side of the same formula: `glyph.repeat(n)` already produces n glyphs,
// so an emoji fill met the target while an emoji label did not. This is the same
// rule firstGlyph() in src/tool/labels.ts applies when reading a typed fill.
const glyphLen = (s: string): number => [...s].length;

/**
 * Decorate a label. The user's text and end-caps are never truncated, so a very
 * long label can exceed `length`; a separating space appears only on a side that
 * actually gets fill. Empty text produces nothing: the Advanced controls are
 * disabled in the UI until there is text, so a blank input always means an
 * icon-only bookmark.
 */
export function formatLabel(rawText: string, opts: LabelFormatOptions): string {
  const text = rawText.trim();
  if (text === '') return '';
  const pre = opts.prepend;
  const app = opts.append;
  const caps = glyphLen(pre) + glyphLen(app);
  const length = clampLength(opts.length);
  const inner = Math.max(0, length - caps);
  const glyph = fillGlyph(opts.fill);

  // No fill: end-caps hug the label with no padding.
  if (!glyph) return pre + text + app;

  let body: string;
  if (opts.align === 'center') {
    const n = inner - glyphLen(text) - 2; // a space each side
    if (n > 0) {
      // With an odd single leftover the left side gets no fill; it then gets no
      // separating space either, and the freed char goes to the right-side fill
      // so the target length is still met.
      const left = Math.floor(n / 2);
      const right = left > 0 ? n - left : n + 1;
      body = (left > 0 ? glyph.repeat(left) + ' ' : '') + text + ' ' + glyph.repeat(right);
    } else {
      body = text;
    }
  } else {
    const n = inner - glyphLen(text) - 1; // one separating space
    if (n > 0) {
      body = opts.align === 'left' ? text + ' ' + glyph.repeat(n) : glyph.repeat(n) + ' ' + text;
    } else {
      body = text;
    }
  }

  return pre + body + app;
}
