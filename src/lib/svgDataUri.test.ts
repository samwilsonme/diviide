import { describe, it, expect } from 'vitest';
import { svgDataUri, maskUrl } from './svgDataUri';

describe('svgDataUri', () => {
  it('prefixes the media type and percent-encodes the SVG', () => {
    expect(svgDataUri('<svg viewBox="0 0 24 24"/>')).toBe(
      'data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2024%2024%22%2F%3E'
    );
  });

  it('encodes double quotes so the URI is safe inside url("…")', () => {
    // encodeURIComponent turns " into %22, which is the whole reason maskUrl can
    // wrap the URI in double quotes without the attribute breaking.
    expect(svgDataUri('<svg a="b"/>')).not.toContain('"');
    expect(svgDataUri('<svg a="b"/>')).toContain('%22');
  });
});

describe('maskUrl', () => {
  it('wraps the data URI in a double-quoted CSS url()', () => {
    // Asserted against a literal, not against `url("${svgDataUri(svg)}")` — that
    // is maskUrl's own body, so the old version compared the function to itself
    // and would have passed for any implementation.
    expect(maskUrl('<svg/>')).toBe('url("data:image/svg+xml,%3Csvg%2F%3E")');
  });

  it('leaves single quotes in the source literal but keeps url() intact', () => {
    // encodeURIComponent does NOT escape ' — so an SVG using single-quoted
    // attributes stays readable in the output, and because the wrapper uses
    // double quotes the url() is still unambiguous.
    const svg = "<svg a='b'/>";
    const out = maskUrl(svg);
    expect(out).toContain("'");
    expect(out.startsWith('url("')).toBe(true);
    expect(out.endsWith('")')).toBe(true);
    // The only unescaped double quotes are the two wrapping the URI.
    expect(out.split('"').length - 1).toBe(2);
  });
});
