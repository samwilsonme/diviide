import { describe, it, expect } from 'vitest';
import { buildHeroTiles, heroTileSources, type HeroTileSources } from './heroTiles';

// The real backdrop pool: 16 non-colorless separators + 40 shapes.
const COUNT = 250;
const sources: HeroTileSources = {
  separators: Array.from({ length: 16 }, (_, i) => `sep-${i}`),
  shapes: Array.from({ length: 40 }, (_, i) => `shape-${i}`),
};
const pool = [...sources.separators, ...sources.shapes];

describe('buildHeroTiles', () => {
  // These assert the properties the consuming site actually depends on, rather
  // than `tiles[i] === pool[i % pool.length]` for every i — which was the
  // implementation restated as its own oracle, and so could only ever catch a
  // *changed* layout, never a wrong one.
  it('fills exactly the requested number of tiles', () => {
    expect(buildHeroTiles(sources, COUNT)).toHaveLength(COUNT);
  });

  it('uses every source icon, so nothing in the catalog is invisible', () => {
    const tiles = new Set(buildHeroTiles(sources, COUNT));
    expect([...pool].filter((name) => !tiles.has(name))).toEqual([]);
  });

  it('starts with the pool in catalog order: separators first, then shapes', () => {
    // The order matters to the site: it interleaves the pool before calling this,
    // and that only works if the tiler lays the list down as given.
    expect(buildHeroTiles(sources, COUNT).slice(0, pool.length)).toEqual(pool);
  });

  it('repeats the pool rather than reshuffling it', () => {
    // A repeat lands pool.length tiles later — which is what keeps a coprime pool
    // size from ever placing the same icon in an adjacent grid cell.
    const tiles = buildHeroTiles(sources, COUNT);
    expect(tiles[pool.length]).toBe(tiles[0]);
    expect(tiles[pool.length + 5]).toBe(tiles[5]);
  });

  it('is deterministic, so HTML, the stylesheet and the OG cards agree', () => {
    expect(buildHeroTiles(sources, COUNT)).toEqual(buildHeroTiles(sources, COUNT));
  });

  it('handles a single non-empty category', () => {
    const onlyShapes = buildHeroTiles({ separators: [], shapes: sources.shapes }, COUNT);
    expect(onlyShapes).toHaveLength(COUNT);
    expect(onlyShapes.slice(0, sources.shapes.length)).toEqual(sources.shapes);
  });

  it('returns empty when there are no icons', () => {
    expect(buildHeroTiles({ separators: [], shapes: [] }, COUNT)).toEqual([]);
  });

  it('derives sources from config (separators + shapes, colorless skipped)', () => {
    const config = {
      icons: {
        a: { category: 'separators' },
        b: { category: 'separators', colorless: true },
        c: { category: 'shapes' },
        d: { category: 'arrows' },
      },
    };
    expect(heroTileSources(config)).toEqual({ separators: ['a'], shapes: ['c'] });
  });
});
