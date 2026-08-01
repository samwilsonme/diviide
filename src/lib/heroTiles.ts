// The hero backdrop's tile list. Separators and shapes are the only icon
// categories used; both the names and (at build time) their mask shapes are fixed
// by config.json, so the grid can be rendered on first paint with no async wait.
//
// Deliberately dependency-free: it takes only a structural view of the config
// (no app or type-alias imports) so any consumer can share it verbatim — the
// private site's homepage hero (HeroGrid.astro) prerenders its backdrop from
// it at build time. One source of truth, no drift.

export interface HeroTileSources {
  separators: string[];
  shapes: string[];
}

// The minimal shape this needs; the app's Config (src/types) satisfies it
// structurally, as does the parsed config.json read at build time.
interface CountableConfig {
  icons: Record<string, { category?: string; colorless?: boolean }>;
}

// Separator and shape icon names (colorless icons skipped — they'd render as
// empty tiles in the decorative backdrop).
export function heroTileSources(config: CountableConfig | null): HeroTileSources {
  const entries = Object.entries(config?.icons ?? {});
  const pick = (category: string) =>
    entries.filter(([, d]) => d.category === category && !d.colorless).map(([n]) => n);
  return { separators: pick('separators'), shapes: pick('shapes') };
}

// Build the backdrop's icon list: every separator followed by every shape, each
// group in config.json insertion order. The icons are tiled in sequence to fill
// `count`; with more tiles than icons the sequence simply repeats. No
// interleaving, no shuffling — fully deterministic, so build-time and runtime
// results are identical.
export function buildHeroTiles(sources: HeroTileSources, count: number): string[] {
  const pool = [...sources.separators, ...sources.shapes];
  if (pool.length === 0) return [];
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}
