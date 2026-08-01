import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HEX_RE, normalizeHex, faviconSvg, roundIconSvg } from './faviconPaint';

describe('faviconPaint stays loadable by plain Node', () => {
  it('has no imports', () => {
    // The whole point of this module is that scripts/verify-favicons.mjs can
    // import it under Node's type stripping, which resolves neither
    // extensionless specifiers nor Vite's import.meta.glob. One import here
    // would break the E2E verifier at a distance, with a module-resolution
    // error that names nothing about this rule — so pin the rule itself.
    const source = readFileSync(
      fileURLToPath(new URL('./faviconPaint.ts', import.meta.url)),
      'utf-8'
    );
    const imports = source.match(/^\s*import\s/gm) ?? [];
    expect(
      imports,
      'faviconPaint.ts must stay import-free — see the note at the top of that file'
    ).toEqual([]);
  });
});

describe('normalizeHex', () => {
  it('lowercases and prefixes a 6-digit hex', () => {
    expect(normalizeHex('E11D48')).toBe('#e11d48');
    expect(normalizeHex('#E11D48')).toBe('#e11d48');
  });

  it('expands a 3-digit hex', () => {
    expect(normalizeHex('abc')).toBe('#aabbcc');
    expect(normalizeHex('#0F8')).toBe('#00ff88');
  });

  it('rejects anything that is not a hex', () => {
    // This is the sanitizer standing between a URL query and an SVG string, so
    // the rejections matter more than the acceptances.
    for (const bad of [
      '',
      'red',
      '#12',
      '#12345',
      '#1234567',
      'ee11d4g',
      '#e11d48;',
      'javascript:',
    ]) {
      expect(normalizeHex(bad), bad).toBeNull();
    }
  });

  it('shares one regex with the exported HEX_RE', () => {
    // The inline bootstrap carries a copy of this pattern (it cannot import), so
    // the pattern is exported to keep that copy comparable to a single source.
    expect(HEX_RE.test('e11d48')).toBe(true);
    expect(HEX_RE.test('nope')).toBe(false);
  });
});

describe('faviconSvg', () => {
  it('paints every black stroke and fill with the hex', () => {
    const template = '<svg><path stroke="black"/><rect fill="black"/><path stroke="black"/></svg>';
    expect(faviconSvg(template, '#14b8a6')).toBe(
      '<svg><path stroke="#14b8a6"/><rect fill="#14b8a6"/><path stroke="#14b8a6"/></svg>'
    );
  });

  it('leaves a template with no placeholder untouched', () => {
    // Colorless icons (config marks them) intentionally carry no placeholder.
    const template = '<svg><path stroke="#ff0000"/></svg>';
    expect(faviconSvg(template, '#14b8a6')).toBe(template);
  });
});

describe('roundIconSvg', () => {
  it('rounds coordinates with 3 or more decimals to 2', () => {
    expect(roundIconSvg('M 18.2216 11.3994')).toBe('M 18.22 11.4');
  });

  it('leaves 1- and 2-decimal coordinates alone', () => {
    // Rewriting these would be churn, and 2 decimals is already the target.
    expect(roundIconSvg('M 1.5 2.25 3')).toBe('M 1.5 2.25 3');
  });

  it('keeps the paint placeholder intact', () => {
    // The rounding runs before faviconSvg, so mangling `black` here would leave
    // every colorable icon permanently untintable.
    expect(roundIconSvg('<path d="M 1.23456 2" stroke="black"/>')).toContain('stroke="black"');
  });
});
