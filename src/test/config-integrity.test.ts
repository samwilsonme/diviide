import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Astro's container renders a real .astro component to HTML inside Vitest, so a
// markup contract can be asserted against the rendered DOM instead of grepped out
// of the source. Node environment only: under jsdom the container resolves a
// different Astro build and fails with "No valid renderer was found".
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import LabelSection from '../components/tool/LabelSection.astro';
import type { Config } from '../types';
import { DEFAULT_COLOR, DEFAULT_COLOR_HEX, THEME_COLOR } from '../lib/colors';
import { normalizeHex, HEX_RE } from '../lib/faviconPaint';
import { FALLBACK_ICON_SVG } from '../lib/favicon';
import { STORAGE_KEYS } from '../lib/storage';
import { MEASURE_FONT } from '../lib/labelFormat';
import { computeSeparatorCountConfig } from '../lib/separatorCounts';

// Resolved from this file, not process.cwd(): the assertions below read this
// repo's own config.json and assets/icons, and a cwd-relative root made the suite
// pass or fail depending on where it was invoked from. In particular it failed
// when run from the consuming site's root (which has none of these source SVGs),
// which is why that repo has to scope Vitest away from the submodule's tests.
const root = fileURLToPath(new URL('../..', import.meta.url));
const config: Config = JSON.parse(readFileSync(join(root, 'public', 'config.json'), 'utf-8'));

// The envelope for inline data-URI icon delivery (see README "Icon delivery").
// Every shape rides the tool page twice (favicon template map + tile mask) at a
// measured ~200 B compressed per icon all-in; 600 KB of raw source SVGs keeps
// the page under a ~150 KB brotli budget. Past that, inlining stops being the
// right trade — switch to the pre-decided successor design (README § At scale),
// don't raise this number.
const MAX_TOTAL_SOURCE_SVG_BYTES = 600 * 1024;
// One shape should be a few hundred bytes; 5 KB means an unoptimized export
// (embedded metadata, unflattened transforms), not a bigger drawing.
const MAX_SINGLE_SOURCE_SVG_BYTES = 5 * 1024;

describe('config integrity', () => {
  it('DEFAULT_COLOR_HEX mirrors the default palette color (no drift)', () => {
    // colors.ts hardcodes the default hex to stay lean (no config import in a
    // client lib); this guards it against config.json drifting away.
    expect(config.colors[DEFAULT_COLOR]).toBe(DEFAULT_COLOR_HEX);
  });

  it('the no-JS CSS fallbacks are both the default palette color', () => {
    // --icon-color and --accent-live are overwritten before first paint by the
    // bootstrap, so these literals are only ever seen when it does not run (JS
    // off, or a bootstrap failure). They must still agree with each other and
    // with DEFAULT_COLOR_HEX: they drifted apart once, leaving that case painting
    // violet accents around teal icons.
    const theme = readFileSync(join(root, 'src', 'styles', 'theme.css'), 'utf-8');
    const fallback = (name: string) => {
      const match = new RegExp(`\\n\\s*--${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`).exec(theme);
      expect(match, `theme.css no longer sets a literal --${name} fallback`).not.toBeNull();
      return normalizeHex(match![1]);
    };
    expect(fallback('icon-color')).toBe(DEFAULT_COLOR_HEX);
    expect(fallback('accent-live')).toBe(DEFAULT_COLOR_HEX);
  });

  it('every palette color is a normalized #rrggbb hex', () => {
    // The runtime trusts palette hexes from data attributes without a guard
    // (normalizeHex(b.dataset.hex!)! in src/tool/main.ts); a malformed value in
    // config.colors would pass the build and crash initTool at runtime.
    const invalid = Object.entries(config.colors)
      .filter(([, hex]) => normalizeHex(hex) !== hex)
      .map(([name, hex]) => `${name}: ${hex}`);
    expect(invalid).toEqual([]);
  });

  it('every icon references a category that exists', () => {
    const categories = new Set(Object.keys(config.categories));
    const orphans = Object.entries(config.icons)
      .filter(([, data]) => !categories.has(data.category))
      .map(([key, data]) => `${key} -> ${data.category}`);
    expect(orphans).toEqual([]);
  });

  it('reserves the "recent" pseudo-category for the UI', () => {
    // "Recently used" is per-user runtime state rendered by CategoryList.astro
    // and filtered by main.ts, not catalog data. A config category with that id
    // would collide with the pinned rail entry.
    expect(config.categories).not.toHaveProperty('recent');
  });

  it('every icon has a matching source SVG in assets/icons', () => {
    const missing = Object.keys(config.icons).filter(
      (name) => !existsSync(join(root, 'assets', 'icons', `${name}.svg`))
    );
    expect(missing).toEqual([]);
  });

  it('every colorable icon carries the stroke/fill="black" paint placeholder', () => {
    // faviconSvg() and the bootstrap recolor a shape by replacing
    // (stroke|fill)="black"; an SVG exported with stroke="#000", "#000000", or
    // currentColor would pass every other check but silently never tint.
    const unpaintable = Object.entries(config.icons)
      .filter(([, data]) => !data.colorless)
      .map(([name]) => name)
      .filter(
        (name) =>
          !/(stroke|fill)="black"/.test(
            readFileSync(join(root, 'assets', 'icons', `${name}.svg`), 'utf-8')
          )
      );
    expect(unpaintable).toEqual([]);
  });

  it('declares the expected number of icons', () => {
    expect(Object.keys(config.icons)).toHaveLength(182);
  });

  it('the package.json description quotes the real icon count', () => {
    // The npm/GitHub blurb hardcodes the count like README prose does; pin it so
    // adding an icon can't leave it stale silently.
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    expect(pkg.description).toContain(`${Object.keys(config.icons).length} separator icons`);
  });

  it('total icon payload stays inside the inline data-URI envelope', () => {
    const total = Object.keys(config.icons)
      .map((name) => join(root, 'assets', 'icons', `${name}.svg`))
      .filter((path) => existsSync(path))
      .reduce((sum, path) => sum + statSync(path).size, 0);
    expect(
      total,
      `Inline icon payload (${Math.round(total / 1024)} KB of source SVGs) exceeds the envelope ` +
        'for data-URI delivery — switch to the pre-decided successor design, see README ' +
        '"Icon delivery" § At scale. Do not raise the threshold.'
    ).toBeLessThanOrEqual(MAX_TOTAL_SOURCE_SVG_BYTES);
  });

  it('no single source SVG is an unoptimized export', () => {
    const oversized = Object.keys(config.icons)
      .map((name) => join(root, 'assets', 'icons', `${name}.svg`))
      .filter((path) => existsSync(path) && statSync(path).size > MAX_SINGLE_SOURCE_SVG_BYTES)
      .map((path) => `${path} (${Math.round(statSync(path).size / 1024)} KB)`);
    expect(
      oversized,
      'These source SVGs are far larger than a shape needs to be — re-export them ' +
        '(strip metadata, flatten transforms) before they bloat every page load.'
    ).toEqual([]);
  });

  it('derives the headline copy the README prose quotes', () => {
    // README and CLAUDE.md hardcode these labels (see the Gotchas section); this
    // pins the derived numbers so prose and math can only drift loudly.
    const counts = computeSeparatorCountConfig(config);
    expect(counts.colorLabel).toBe('16.7 million');
    expect(counts.combinationsLabel).toBe('3 billion+');
  });
});

describe('favicon logic copies stay in sync', () => {
  // A cold bookmark load (the inline bootstrap), a live re-tint (favicon.ts), and
  // the E2E verifier's rebuilt oracle (scripts/verify-favicons.mjs) must all
  // produce byte-identical favicons.
  //
  // Two of those three now share one implementation: the paint primitives live in
  // src/lib/faviconPaint.ts, which favicon.ts re-exports and verify-favicons.mjs
  // imports directly (it is import-free so plain Node can load it —
  // faviconPaint.test.ts pins that). Those copies are gone, and with them the
  // source-text assertions that used to police them.
  //
  // The inline bootstrap is the one copy that remains, because an inline
  // define:vars script cannot import. It is verified by execution rather than by
  // grepping: prePaintBootstrap.dom.test.ts runs the real IIFE and compares its
  // output against faviconPaint's own painter. What is left here are the literals
  // the bootstrap must share with modules it cannot import.
  const bootstrap = readFileSync(
    join(root, 'src', 'components', 'PrePaintBootstrap.astro'),
    'utf-8'
  );

  it('the bootstrap validates hexes with the same pattern as the module', () => {
    // Compared against HEX_RE's own source rather than a hand-typed literal, so
    // the pin cannot drift from the implementation it is pinning.
    expect(bootstrap).toContain(HEX_RE.source);
  });

  it('the bootstrap reads the same color key the runtime persists', () => {
    // The bootstrap is an inline script that cannot import STORAGE_KEYS, so it
    // hardcodes the key; renaming it in storage.ts must fail here, not leave
    // the bootstrap silently pre-painting the default color from a dead key.
    expect(bootstrap).toContain(`localStorage.getItem('${STORAGE_KEYS.color}')`);
  });

  it('the bootstrap reads the same theme key the header toggle persists', () => {
    // Same arrangement as the color key: the header (src/components/Header.astro)
    // persists under STORAGE_KEYS.theme; the inline bootstrap hardcodes the literal.
    expect(bootstrap).toContain(`localStorage.getItem('${STORAGE_KEYS.theme}')`);
  });

  it('the E2E verifier builds its oracle from the shared painter', () => {
    // The verifier used to carry its own copies of the hex regex, the paint
    // replacement and the coordinate rounding, pinned here by source text. It now
    // imports all three from faviconPaint, so the guarantee is structural. Assert
    // the import rather than the old literals, so reintroducing a private copy is
    // what fails — the drift this test exists to prevent.
    //
    // Only the positive assertion remains. Two "the source must NOT contain this
    // string" checks used to sit here, and they were a trap: a comment in the
    // verifier that merely mentioned a hex pattern failed the tool's whole test
    // suite. The import above is what actually guarantees there is no second copy.
    const verifier = readFileSync(join(root, 'scripts', 'verify-favicons.mjs'), 'utf-8');
    expect(verifier).toContain("from '../src/lib/faviconPaint.ts'");
  });

  it('the last-resort fallback favicon mirrors the real default-icon shape', () => {
    // getIconTemplate() falls back to an inlined copy of the default separator
    // shape so a missing template map can never yield a broken favicon. That copy
    // duplicates assets/icons/lines-vertical-small.svg; compare the path data
    // (order-insensitive) so the drawing can't drift.
    //
    // FALLBACK_ICON_SVG is imported, not regexed back out of favicon.ts source:
    // the old version broke if the literal was ever reformatted or switched to a
    // template literal.
    const pathData = (svg: string) =>
      [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]).sort();
    const source = readFileSync(join(root, 'assets', 'icons', 'lines-vertical-small.svg'), 'utf-8');
    expect(pathData(FALLBACK_ICON_SVG)).toEqual(pathData(source));
    expect(pathData(FALLBACK_ICON_SVG).length).toBeGreaterThan(0);
  });

  it('the label fit meter measures in the same font the preview renders', async () => {
    // labels.ts measures candidate labels on a canvas; LabelSection.astro renders
    // the live preview. The canvas half now imports MEASURE_FONT, so that side
    // cannot drift by construction — this test only has to hold the component's
    // spelling of the same font against it. The component cannot import it:
    // Tailwind's scanner only emits a class it can see written out as a literal.
    //
    // Both halves are asserted against RENDERED output, not source text. An
    // earlier version grepped labels.ts for the literal canvas font string, which
    // failed on a rename with no behavior change, and searched the component
    // source for "a class attribute containing the font stack" — which could only
    // ever prove that some element somewhere carried both, and had already needed
    // rewriting once because Prettier's class sorter can reorder them.
    const font = /^(\d+)px (.+)$/.exec(MEASURE_FONT);
    expect(
      font,
      `MEASURE_FONT is not a "<size>px <stack>" canvas font: ${MEASURE_FONT}`
    ).not.toBeNull();
    const [, sizePx, stack] = font!;
    const leadFamily = stack.split(',')[0].trim();

    const container = await AstroContainer.create();
    const { document } = new JSDOM(await container.renderToString(LabelSection)).window;

    const preview = document.querySelector('[data-label-preview]');
    expect(preview, 'LabelSection no longer renders a [data-label-preview]').not.toBeNull();

    // The stack sits on the preview's container, so walk up from the preview itself
    // — that ancestry is part of what makes the two fonts the same font.
    const styled = preview!.closest(`[class*="font-family:${leadFamily}"]`);
    expect(
      styled,
      `nothing around [data-label-preview] renders in ${leadFamily}, the family the fit meter measures in`
    ).not.toBeNull();
    // 12px is what Tailwind's text-xs resolves to, so the meter and the preview
    // agree on size as well as family.
    expect(sizePx, 'MEASURE_FONT is no longer the 12px that text-xs renders at').toBe('12');
    expect(
      styled!.className,
      'the preview font stack and its text size are on different elements'
    ).toContain('text-xs');
  });

  it('the bootstrap pre-paints the theme-color hexes theme.css documents', () => {
    // No stylesheet exists pre-paint, so the bootstrap seeds the browser-chrome
    // color with literal hexes that must mirror the --background tokens in
    // theme.css (documented there as sRGB hex comments beside the oklch values).
    //
    // The bootstrap takes them from THEME_COLOR through define:vars, so this
    // compares theme.css against the same constant the script ships. It used to
    // regex the pair back out of the bootstrap's source, which meant the test
    // depended on Prettier's spacing around a ternary.
    const theme = readFileSync(join(root, 'src', 'styles', 'theme.css'), 'utf-8').toLowerCase();
    expect(theme).toContain(THEME_COLOR.dark.toLowerCase());
    expect(theme).toContain(THEME_COLOR.light.toLowerCase());
  });
});
