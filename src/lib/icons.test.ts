import { describe, it, expect } from 'vitest';
import type { Config } from '../types';
import { computeCategoryCounts } from './icons';

const config: Config = {
  colors: {},
  categories: { all: 'All', shapes: 'Shapes', arrows: 'Arrows' },
  icons: {
    'circle-small': { name: 'Circle Small', category: 'shapes', keywords: ['dot', 'round'] },
    'arrow-right': { name: 'Arrow Right', category: 'arrows', keywords: ['next', 'chevron'] },
    square: { name: 'Square', category: 'shapes', keywords: ['box'] },
  },
};

describe('computeCategoryCounts', () => {
  it("counts icons per category plus a synthetic 'all' total", () => {
    expect(computeCategoryCounts(config)).toEqual({ all: 3, shapes: 2, arrows: 1 });
  });
});
