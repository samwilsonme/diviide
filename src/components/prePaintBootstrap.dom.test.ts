// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_COLOR_HEX } from '../lib/colors';
import { DEFAULT_SEPARATOR_ICON } from '../lib/favicon';
import { faviconSvg } from '../lib/faviconPaint';
import { svgDataUri } from '../lib/svgDataUri';
import { TOOL_PATH } from '../lib/bookmarkUrl';

// Behavioral spec for the favicon/color IIFE in PrePaintBootstrap.astro. It is an
// inline define:vars script, so it can't be imported as a module; this suite
// extracts the first IIFE's body from the .astro source and runs it in jsdom with
// the same five variables define:vars injects.
//
// The bootstrap holds the one unavoidable copy of the favicon paint (an inline
// script cannot import), so this suite is what keeps that copy honest: every
// expected href below is built with the REAL painter from lib/faviconPaint, so a
// divergence between the inline copy and the module fails here — a cold-loaded
// bookmark and a live re-tint must produce byte-identical favicons.

// cwd-relative, not import.meta.url: this is a jsdom suite, and jsdom rebases
// import.meta.url onto its http:// document URL, so fileURLToPath rejects it.
const source = readFileSync(
  join(process.cwd(), 'src', 'components', 'PrePaintBootstrap.astro'),
  'utf-8'
);
const OPEN = '(function () {';
const CLOSE = '})();';
const start = source.indexOf(OPEN);
const body = source.slice(start + OPEN.length, source.indexOf(CLOSE, start));

const palette = { default: DEFAULT_COLOR_HEX, rose: '#e11d48' };
const templates: Record<string, string> = {
  [DEFAULT_SEPARATOR_ICON]: '<svg stroke="black" fill="black"><path d="M9 5v14"/></svg>',
  star: '<svg stroke="black"><path d="M12 2l3 7"/></svg>',
};

function runBootstrap(): void {
  new Function('palette', 'templates', 'defaultHex', 'defaultIcon', 'toolPath', body)(
    palette,
    templates,
    DEFAULT_COLOR_HEX,
    DEFAULT_SEPARATOR_ICON,
    TOOL_PATH
  );
}

// The exact data URI the bootstrap should emit, built by the app's own painter
// and encoder rather than a copy of them — so these assertions compare the
// inline script against the real implementation, not against a third rewrite.
const paintedHref = (icon: string, hex: string): string =>
  svgDataUri(faviconSvg(templates[icon], hex));

const faviconHref = (): string | null =>
  document.getElementById('diviide-favicon')?.getAttribute('href') ?? null;
const iconColor = (): string => document.documentElement.style.getPropertyValue('--icon-color');
const accentLive = (): string => document.documentElement.style.getPropertyValue('--accent-live');

beforeEach(() => {
  localStorage.clear();
  document.getElementById('diviide-favicon')?.remove();
  document.documentElement.style.removeProperty('--icon-color');
  document.documentElement.style.removeProperty('--accent-live');
  history.replaceState({}, '', '/');
});

describe('pre-paint bootstrap favicon + color IIFE', () => {
  it('extracted the favicon IIFE, not the theme one', () => {
    // The body is found by string search, so a reformat to `(function() {`, a new
    // IIFE inserted above this one, or a comment containing `})();` would silently
    // hand every test below the wrong code. The theme IIFE would even run without
    // throwing, so assert on markers only the favicon block carries.
    expect(body, 'the extracted IIFE does not create the favicon link').toContain(
      'diviide-favicon'
    );
    expect(body, 'the extracted IIFE does not read the bookmark query').toContain(
      'URLSearchParams'
    );
    expect(body, 'the theme IIFE was extracted instead of the favicon one').not.toContain(
      'prefers-color-scheme'
    );
  });

  it('paints the bookmarked icon and color from a valid bookmark URL', () => {
    history.replaceState({}, '', `${TOOL_PATH}?icon=star&color=e11d48`);
    runBootstrap();
    expect(faviconHref()).toBe(paintedHref('star', '#e11d48'));
    expect(iconColor()).toBe('#e11d48');
  });

  it('ignores an invalid ?color and falls back to the persisted color', () => {
    history.replaceState({}, '', `${TOOL_PATH}?icon=star&color=notahex`);
    localStorage.setItem('diviide-color', '#e11d48');
    runBootstrap();
    // The icon only comes from the query alongside a valid color, so both
    // fall back: default icon, persisted color.
    expect(faviconHref()).toBe(paintedHref(DEFAULT_SEPARATOR_ICON, '#e11d48'));
    expect(iconColor()).toBe('#e11d48');
  });

  it('falls back to the default color when nothing valid is stored either', () => {
    history.replaceState({}, '', `${TOOL_PATH}?icon=star&color=notahex`);
    localStorage.setItem('diviide-color', 'alsonotahex');
    runBootstrap();
    expect(faviconHref()).toBe(paintedHref(DEFAULT_SEPARATOR_ICON, DEFAULT_COLOR_HEX));
    expect(iconColor()).toBe(DEFAULT_COLOR_HEX);
  });

  it('still produces the default favicon when localStorage is blocked', () => {
    const original = window.localStorage;
    const blocked = {
      getItem(): string | null {
        throw new Error('storage disabled');
      },
      clear(): void {},
    } as unknown as Storage;
    for (const target of [window, globalThis]) {
      Object.defineProperty(target, 'localStorage', {
        value: blocked,
        writable: true,
        configurable: true,
      });
    }
    try {
      runBootstrap();
      expect(faviconHref()).toBe(paintedHref(DEFAULT_SEPARATOR_ICON, DEFAULT_COLOR_HEX));
      expect(iconColor()).toBe(DEFAULT_COLOR_HEX);
    } finally {
      for (const target of [window, globalThis]) {
        Object.defineProperty(target, 'localStorage', {
          value: original,
          writable: true,
          configurable: true,
        });
      }
    }
  });

  it('paints an unknown bookmarked icon with the default template', () => {
    history.replaceState({}, '', `${TOOL_PATH}?icon=no-such-icon&color=e11d48`);
    runBootstrap();
    expect(faviconHref()).toBe(paintedHref(DEFAULT_SEPARATOR_ICON, '#e11d48'));
  });

  it('treats an inherited object key as an unknown icon and keeps running', () => {
    // `templates` is a plain object, so 'constructor'/'__proto__' are truthy
    // inherited keys; without an own-property check they shadow the fallback
    // and the `.replace` paint throws — which would also kill the theme IIFE
    // sharing this script tag.
    history.replaceState({}, '', `${TOOL_PATH}?icon=constructor&color=e11d48`);
    expect(() => runBootstrap()).not.toThrow();
    expect(faviconHref()).toBe(paintedHref(DEFAULT_SEPARATOR_ICON, '#e11d48'));

    history.replaceState({}, '', `${TOOL_PATH}?icon=__proto__&color=e11d48`);
    expect(() => runBootstrap()).not.toThrow();
    expect(faviconHref()).toBe(paintedHref(DEFAULT_SEPARATOR_ICON, '#e11d48'));
  });

  it('keeps the accent on the brand default for a non-palette hex', () => {
    history.replaceState({}, '', `${TOOL_PATH}?icon=star&color=ff0000`);
    runBootstrap();
    expect(iconColor()).toBe('#ff0000');
    expect(accentLive()).toBe(DEFAULT_COLOR_HEX);
  });

  it('themes the accent with a palette hex', () => {
    history.replaceState({}, '', `${TOOL_PATH}?icon=star&color=e11d48`);
    runBootstrap();
    expect(accentLive()).toBe('#e11d48');
  });
});
