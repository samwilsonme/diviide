// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setFavicon,
  selectFavicon,
  restoreUrlAfterSelect,
  normalizeHex,
  getIconTemplate,
  faviconSvg,
} from './favicon';
import { DEFAULT_COLOR_HEX } from './colors';

// A minimal shape template with a black stroke to recolor, keyed by the icon
// names the tests use. In the app these are inlined by the pre-paint bootstrap
// onto window.__diviideIconTemplates.
const TEMPLATE = '<svg viewBox="0 0 24 24"><path d="M9 5L9 19" stroke="black"/></svg>';

// Decode a data:image/svg+xml URI back to its SVG string.
function svgOf(href: string): string {
  return decodeURIComponent(href.replace('data:image/svg+xml,', ''));
}

describe('favicon helpers', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    window.__diviideIconTemplates = {
      pipe: TEMPLATE,
      'arrow-up': TEMPLATE,
      'lines-vertical-small': TEMPLATE,
    };
    // Clear any origin a prior test's selectFavicon parked on `window`.
    window.__diviideParkedFrom = undefined;
    history.replaceState({}, '', '/');
  });

  // Restore spied history methods so a spy in one test can't accumulate calls
  // into the next test's freshly re-spied reference.
  afterEach(() => vi.restoreAllMocks());

  it('setFavicon creates a #diviide-favicon link with an on-the-fly data URI', () => {
    setFavicon('pipe', '#f43f5e');
    const el = document.getElementById('diviide-favicon') as HTMLLinkElement;
    expect(el).not.toBeNull();
    expect(el.rel).toBe('icon');
    const href = el.getAttribute('href')!;
    expect(href.startsWith('data:image/svg+xml,')).toBe(true);
    // The hex painted the shape (black placeholder replaced).
    expect(svgOf(href)).toContain('stroke="#f43f5e"');
    expect(svgOf(href)).not.toContain('black');
  });

  it('setFavicon reuses the existing #diviide-favicon link', () => {
    setFavicon('pipe', '#f43f5e');
    const first = document.getElementById('diviide-favicon');
    setFavicon('arrow-up', '#3b82f6');
    const second = document.getElementById('diviide-favicon') as HTMLLinkElement;
    expect(second).toBe(first);
    expect(svgOf(second.getAttribute('href')!)).toContain('stroke="#3b82f6"');
  });

  it('setFavicon renders an arbitrary hex (with or without a leading #)', () => {
    // Any color-wheel / URL hex renders end-to-end with no per-color file.
    setFavicon('pipe', 'e11d48');
    const href = document.getElementById('diviide-favicon')!.getAttribute('href')!;
    expect(svgOf(href)).toContain('stroke="#e11d48"');
  });

  it('setFavicon falls back to the brand default for an invalid color', () => {
    // Never inject an unvalidated string into the SVG. A non-hex value resolves
    // to the brand default rather than a broken favicon.
    setFavicon('pipe', 'not-a-color');
    const svg = svgOf(document.getElementById('diviide-favicon')!.getAttribute('href')!);
    expect(svg).toContain(`stroke="${DEFAULT_COLOR_HEX}"`);
    expect(svg).not.toContain('not-a-color');
  });

  it('getIconTemplate falls back to the default separator shape for an unknown icon', () => {
    expect(getIconTemplate('no-such-icon')).toBe(TEMPLATE);
  });

  it('getIconTemplate treats inherited object keys as unknown icons', () => {
    // The template map is a plain object; a name like 'constructor' must fall
    // back to the default shape, not surface Object.prototype's function.
    expect(getIconTemplate('constructor')).toBe(TEMPLATE);
    expect(getIconTemplate('__proto__')).toBe(TEMPLATE);
  });

  it('getIconTemplate falls back to the inlined last-resort shape when no templates exist', () => {
    // A page whose bootstrap failed (or a consumer that never inlined the map)
    // must still get a paintable favicon, never a broken one.
    window.__diviideIconTemplates = {};
    const svg = getIconTemplate('anything');
    expect(svg).toContain('<svg');
    expect(svg).toContain('stroke="black"');
  });

  it('faviconSvg paints every stroke/fill placeholder with the given hex', () => {
    const out = faviconSvg('<svg><path stroke="black"/><rect fill="black"/></svg>', '#e11d48');
    expect(out).toBe('<svg><path stroke="#e11d48"/><rect fill="#e11d48"/></svg>');
  });

  it('selectFavicon updates both the URL and the favicon href', () => {
    const spy = vi.spyOn(history, 'pushState');
    selectFavicon('arrow-up', '#f59e0b');
    expect(spy).toHaveBeenCalledWith({}, '', '/separators/?icon=arrow-up&color=f59e0b');
    const href = document.getElementById('diviide-favicon')!.getAttribute('href')!;
    expect(svgOf(href)).toContain('stroke="#f59e0b"');
  });

  it('normalizeHex accepts #rgb, #rrggbb, and bare hex, and rejects the rest', () => {
    expect(normalizeHex('E11D48')).toBe('#e11d48');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('rose')).toBeNull();
    expect(normalizeHex('#12g')).toBeNull();
  });

  it('restoreUrlAfterSelect returns to the URL the page was on before selectFavicon', () => {
    history.replaceState({}, '', '/separators/');
    selectFavicon('arrow-up', '#f59e0b');
    expect(window.location.search).toBe('?icon=arrow-up&color=f59e0b');

    restoreUrlAfterSelect();
    expect(window.location.pathname + window.location.search).toBe('/separators/');
  });

  it('restoreUrlAfterSelect preserves the original query and hash', () => {
    history.replaceState({}, '', '/separators/?foo=bar#baz');
    selectFavicon('pipe', '#f43f5e');
    restoreUrlAfterSelect();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/separators/?foo=bar#baz'
    );
  });

  it('restoreUrlAfterSelect is a no-op when selectFavicon has not parked the URL', () => {
    history.replaceState({}, '', '/separators/');
    const spy = vi.spyOn(history, 'replaceState');
    restoreUrlAfterSelect();
    expect(spy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/separators/');
  });

  it('restoreUrlAfterSelect only captures the URL once across repeated selects', () => {
    history.replaceState({}, '', '/separators/');
    selectFavicon('pipe', '#f43f5e');
    selectFavicon('arrow-up', '#f59e0b');
    restoreUrlAfterSelect();
    // Restores to the pre-drag origin, not the first parked bookmark URL — the
    // second select sees a bookmark URL and must not capture it as the origin.
    expect(window.location.pathname + window.location.search).toBe('/separators/');
  });

  it('repeated selects add exactly one history entry, not one per select', () => {
    // Picking a separator parks the page on the bookmark URL. Only the first
    // select of a sequence should push: every later one replaces, so Back always
    // means "return to the app" rather than "step back through every icon the
    // visitor tried".
    history.replaceState({}, '', '/separators/');
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');

    selectFavicon('pipe', '#f43f5e');
    selectFavicon('arrow-up', '#f59e0b');
    selectFavicon('circle-filled-small', '#10b981');

    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(2);
    // The URL still ends on the most recent pick, whichever method got it there.
    expect(window.location.search).toBe('?icon=circle-filled-small&color=10b981');
  });

  it('restores to the real origin route, not a hardcoded root', () => {
    history.replaceState({}, '', '/guides/getting-started');
    selectFavicon('pipe', '#f43f5e');
    expect(window.location.pathname + window.location.search).toBe(
      '/separators/?icon=pipe&color=f43f5e'
    );
    restoreUrlAfterSelect();
    expect(window.location.pathname).toBe('/guides/getting-started');
  });

  it('parks the origin on window so it survives an HMR module reset', () => {
    // The origin must NOT live in a module variable: a dev HMR hot-swap would
    // reset it and strand the page on the bookmark URL, letting the next
    // color-change re-tint corrupt the saved bookmark's favicon. A window
    // property survives a module swap (same realm) so a fresh module instance can
    // still restore — but resets on a real page load (new realm), so opening a
    // saved bookmark never sees a stale origin.
    history.replaceState({}, '', '/separators/');
    selectFavicon('pipe', '#f43f5e');
    expect(window.__diviideParkedFrom).toBe('/separators/');
    restoreUrlAfterSelect();
    expect(window.__diviideParkedFrom ?? null).toBeNull();
  });

  it('does not un-park a freshly opened bookmark URL (no origin in this realm)', () => {
    // Opening a saved bookmark loads the page at its bookmark URL with no parked
    // origin set in this (fresh) realm. restoreUrlAfterSelect() must be a no-op so
    // the page stays on the bookmark URL and the re-tint guard preserves the
    // frozen favicon — instead of re-tinting it to the default icon + latest
    // color (the regression this guards against).
    window.__diviideParkedFrom = undefined;
    history.replaceState({}, '', '/separators/?icon=pipe&color=f43f5e');
    const spy = vi.spyOn(history, 'replaceState');
    restoreUrlAfterSelect();
    expect(spy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?icon=pipe&color=f43f5e');
  });
});
