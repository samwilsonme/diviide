import { describe, it, expect } from 'vitest';
import {
  formatLabel,
  describeLabelFit,
  labelFitLevel,
  LABEL_PRESETS,
  DEFAULT_LABEL_OPTIONS,
  type LabelFormatOptions,
} from './labelFormat';

const opts = (over: Partial<LabelFormatOptions> = {}): LabelFormatOptions => ({
  ...DEFAULT_LABEL_OPTIONS,
  ...over,
});

describe('formatLabel', () => {
  it('is a no-op with default options (fill none, no caps)', () => {
    expect(formatLabel('Work', opts())).toBe('Work');
  });

  it('trims the label', () => {
    expect(formatLabel('  Work  ', opts())).toBe('Work');
  });

  it('reproduces the worked example', () => {
    const out = formatLabel(
      'hello',
      opts({ align: 'center', fill: '-', prepend: '<', append: '>', length: 19 })
    );
    expect(out).toBe('<----- hello ----->');
    expect(out).toHaveLength(19);
  });

  it('pads to the target length for left align (fill on the right)', () => {
    const out = formatLabel('Work', opts({ align: 'left', fill: '-', length: 20 }));
    expect(out).toBe('Work ---------------');
    expect(out).toHaveLength(20);
  });

  it('pads to the target length for right align (fill on the left)', () => {
    const out = formatLabel('Work', opts({ align: 'right', fill: '-', length: 20 }));
    expect(out).toBe('--------------- Work');
    expect(out).toHaveLength(20);
  });

  it('centers with the extra fill char biased to the right (odd remainder)', () => {
    const out = formatLabel('hello', opts({ align: 'center', fill: '-', length: 20 }));
    // inner 20, remainder 20 - 5 - 2 = 13 -> left 6, right 7
    expect(out).toBe('------ hello -------');
    expect(out).toHaveLength(20);
  });

  it('skips the left space entirely when centering leaves the left no fill', () => {
    // inner 10, remainder 10 - 7 - 2 = 1 -> left fill 0, so no left space either;
    // the freed char joins the right fill and the target length still holds.
    const out = formatLabel('1234567', opts({ align: 'center', fill: '-', length: 10 }));
    expect(out).toBe('1234567 --');
    expect(out).toHaveLength(10);
  });

  it('treats block/square glyphs as single characters for the count', () => {
    const out = formatLabel('X', opts({ align: 'left', fill: '█', length: 10 }));
    expect(out).toBe('X ████████');
    expect(out).toHaveLength(10);
  });

  it('counts an emoji label as one character, not two code units', () => {
    // '🎉 Party' is 7 characters but String.length reports 8, which used to eat a
    // fill char off the target length.
    const out = formatLabel('🎉 Party', opts({ align: 'left', fill: '-', length: 20 }));
    expect([...out]).toHaveLength(20);
    // inner 20, label 7 glyphs, one separating space -> 12 fill chars
    expect(out).toBe('🎉 Party ' + '-'.repeat(12));
  });

  it('counts a multi-code-point emoji label as one character', () => {
    // A ZWJ family sequence is 8 code units and 5 code points, but reads as one
    // glyph. Code-point counting is what firstGlyph() applies to fills too, so
    // this is the closest the string model gets without segmenter overhead.
    const out = formatLabel('👨‍👩‍👧', opts({ align: 'left', fill: '-', length: 12 }));
    expect(out.endsWith('-')).toBe(true);
    expect([...out]).toHaveLength(12);
  });

  it('counts an emoji end-cap as one character', () => {
    const out = formatLabel('Hi', opts({ align: 'left', fill: '-', prepend: '🔥', length: 10 }));
    expect([...out]).toHaveLength(10);
  });

  it('clamps length above the max', () => {
    const out = formatLabel('Hi', opts({ align: 'left', fill: '-', length: 999 }));
    // clamps to 60
    expect(out).toHaveLength(60);
  });

  it('clamps length below the min', () => {
    const out = formatLabel('Hi', opts({ align: 'right', fill: '-', length: 1 }));
    // clamps to 10
    expect(out).toHaveLength(10);
    expect(out).toBe('------- Hi');
  });

  it('returns empty for empty or whitespace text regardless of decoration', () => {
    expect(formatLabel('', opts())).toBe('');
    expect(formatLabel('   ', opts())).toBe('');
    expect(formatLabel('', opts({ fill: '-', prepend: '<', append: '>', length: 20 }))).toBe('');
  });

  it('never truncates a label longer than the target, but keeps caps', () => {
    const long = 'a-very-long-label-indeed';
    const out = formatLabel(
      long,
      opts({ align: 'center', fill: '-', prepend: '<', append: '>', length: 10 })
    );
    expect(out).toBe('<' + long + '>');
  });

  it('drops the separating space when there is no room for fill', () => {
    // inner 10, label 9, left align: n = 10 - 9 - 1 = 0 -> no fill, no space
    const out = formatLabel('123456789', opts({ align: 'left', fill: '-', length: 10 }));
    expect(out).toBe('123456789');
  });

  it('wraps the label in caps with no padding when fill is none', () => {
    expect(formatLabel('Work', opts({ prepend: '[', append: ']' }))).toBe('[Work]');
  });
});

describe('labelFitLevel', () => {
  it('maps widths to fit tiers at the boundaries', () => {
    expect(labelFitLevel(0)).toBe('fits');
    expect(labelFitLevel(120)).toBe('fits');
    expect(labelFitLevel(121)).toBe('bar');
    expect(labelFitLevel(360)).toBe('bar');
    expect(labelFitLevel(361)).toBe('folder');
    expect(labelFitLevel(9999)).toBe('folder');
  });
});

describe('describeLabelFit', () => {
  it('shows no warning at or below the bookmarks bar budget', () => {
    expect(describeLabelFit(0)).toBe('');
    expect(describeLabelFit(120)).toBe('');
  });

  it('warns of bookmarks-bar truncation between the bar and folder budgets', () => {
    expect(describeLabelFit(121)).toBe('truncates in bookmarks bar');
    expect(describeLabelFit(360)).toBe('truncates in bookmarks bar');
  });

  it('warns of folder truncation beyond the folder budget', () => {
    expect(describeLabelFit(361)).toBe('truncates in folder');
    expect(describeLabelFit(9999)).toBe('truncates in folder');
  });
});

describe('LABEL_PRESETS', () => {
  it('produces the expected look for each preset', () => {
    const byName = Object.fromEntries(LABEL_PRESETS.map((p) => [p.name, p.options]));
    expect(formatLabel('Work', byName.Dashes)).toBe('<------ Work ------>');
    expect(formatLabel('Work', byName.Brackets)).toBe('[Work]');
    expect(formatLabel('Work', byName.Blocks)).toBe('███████ Work ███████');
    expect(formatLabel('Work', byName.Dots)).toBe('....... Work .......');
  });
});
