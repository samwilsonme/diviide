import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '../types';
import { iconTemplates } from './iconTemplates';

// Resolved from this file rather than process.cwd(), so the suite reads this
// repo's config wherever it is invoked from (see config-integrity.test.ts).
const root = fileURLToPath(new URL('../..', import.meta.url));
const config: Config = JSON.parse(readFileSync(join(root, 'public', 'config.json'), 'utf-8'));

describe('iconTemplates', () => {
  it('has a template for every configured icon', () => {
    const missing = Object.keys(config.icons).filter((name) => !(name in iconTemplates));
    expect(missing).toEqual([]);
  });

  it('leaves no high-precision coordinates after rounding', () => {
    // Every consumer (bootstrap, tile masks, favicon) reads this map, so the
    // rounding must actually have run on every template.
    const unrounded = Object.entries(iconTemplates)
      .filter(([, svg]) => /\d+\.\d{3,}/.test(svg))
      .map(([name]) => name);
    expect(unrounded).toEqual([]);
  });

  it('rounding preserves the paint placeholder on every colorable icon', () => {
    // The recolor replaces (stroke|fill)="black"; a rounding regex gone wrong
    // could mangle attribute text and leave a shape that never tints.
    const unpaintable = Object.entries(config.icons)
      .filter(([, data]) => !data.colorless)
      .map(([name]) => name)
      .filter((name) => !/(stroke|fill)="black"/.test(iconTemplates[name]));
    expect(unpaintable).toEqual([]);
  });
});

// The rounding itself is unit-tested against literals in faviconPaint.test.ts.
// This file used to spot-check it by asserting on the exact path data of one
// checked-in asset (0-small.svg), which failed whenever that icon was re-exported
// — a test about rounding breaking for a reason unrelated to rounding.
