import { describe, it, expect } from 'vitest';
import { computeSeparatorCountConfig } from './separatorCounts';

// 256^3, the full 24-bit hex space the Advanced wheel exposes. Used below to
// express what the combination count SHOULD be, independently of how the module
// computes it.
//
// There is no longer a test asserting colorCount === this: that value has no input
// dependency, so the assertion only restated the module's own constant back to it.
// The labels derived from these numbers are worth pinning, and
// config-integrity.test.ts does that against the real config, where README prose
// quotes the same figures.
const TOTAL_COLORS = 16_777_216;

describe('computeSeparatorCountConfig', () => {
  it('multiplies colorable separators by the color count', () => {
    const counts = computeSeparatorCountConfig({ icons: { a: {}, b: {} } });
    expect(counts.separatorCount).toBe(2);
    expect(counts.combinations).toBe(2 * TOTAL_COLORS);
  });

  it('counts a colorless separator as a single combination, not one per color', () => {
    const counts = computeSeparatorCountConfig({
      icons: { a: {}, b: {}, blank: { colorless: true } },
    });
    expect(counts.separatorCount).toBe(3);
    expect(counts.combinations).toBe(2 * TOTAL_COLORS + 1);
  });

  it('truncates the combinations label so the copy never overstates', () => {
    // The real catalog shape: 182 separators, one colorless.
    const icons = Object.fromEntries(
      Array.from({ length: 182 }, (_, i) => [`icon-${i}`, i === 0 ? { colorless: true } : {}])
    );
    const counts = computeSeparatorCountConfig({ icons });
    expect(counts.combinations).toBe(181 * TOTAL_COLORS + 1);
    expect(counts.combinationsLabel).toBe('3 billion+');
  });

  it('handles a null config as an empty catalog', () => {
    const counts = computeSeparatorCountConfig(null);
    expect(counts.separatorCount).toBe(0);
    expect(counts.combinations).toBe(0);
  });
});
