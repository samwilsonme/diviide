// The single source of truth for the headline counts shown throughout the site
// (color count, separator count, total combinations). The separator count still
// derives from config.json; the color count is the full 24-bit hex space,
// because the Advanced color wheel makes every 6-digit hex pickable — not just
// the preset palette. `colorLabel` / `combinationsLabel` are the human-friendly
// forms used in copy so the marketing numbers never drift from the math.
//
// Deliberately dependency-free: it takes only a structural view of the config
// (no app/React/type-alias imports) so it can be shared verbatim by both the app
// and the build. One formula, no drift.
export interface SeparatorCountConfig {
  colorCount: number;
  separatorCount: number;
  combinations: number;
  /** e.g. "16.7 million" — the color count for copy. */
  colorLabel: string;
  /** e.g. "3 billion+" — the combinations count for copy. */
  combinationsLabel: string;
}

// The minimal shape this needs; the app's Config (src/types) satisfies it
// structurally, as does the parsed config.json read at build time.
interface CountableConfig {
  icons: Record<string, { colorless?: boolean }>;
}

// Every 6-digit hex is pickable via the Advanced color wheel, so the available
// colors are the full 24-bit sRGB space (256^3), not the preset palette.
const TOTAL_COLORS = 256 ** 3; // 16,777,216

// Friendly magnitude labels for the headline copy. Truncated (not rounded) so
// they never overstate: 16,777,216 -> "16.7 million", 3,003,121,665 -> "3 billion+".
const millionsLabel = (n: number): string => `${(Math.floor(n / 1e5) / 10).toFixed(1)} million`;
const billionsLabel = (n: number): string => `${Math.floor(n / 1e9)} billion+`;

export function computeSeparatorCountConfig(config: CountableConfig | null): SeparatorCountConfig {
  const separators = Object.values(config?.icons ?? {});
  const separatorCount = separators.length;
  const colorCount = TOTAL_COLORS;
  // Colorless separators (e.g. the blank "space" separator) ship a single
  // variant, so they add one combination each rather than one per color.
  const colorlessCount = separators.filter((s) => s.colorless).length;
  const combinations = colorCount * (separatorCount - colorlessCount) + colorlessCount;
  return {
    colorCount,
    separatorCount,
    combinations,
    colorLabel: millionsLabel(colorCount),
    combinationsLabel: billionsLabel(combinations),
  };
}
