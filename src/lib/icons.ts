import type { Config } from '../types';

// Count icons per category, plus a synthetic `all` total. (Runtime filtering
// itself lives in src/tool/main.ts, driven by the tiles' baked-in data
// attributes — no config lookup needed there.)
export function computeCategoryCounts(config: Config): Record<string, number> {
  const counts: Record<string, number> = {
    all: Object.keys(config.icons).length,
  };

  for (const iconData of Object.values(config.icons)) {
    counts[iconData.category] = (counts[iconData.category] || 0) + 1;
  }

  return counts;
}
