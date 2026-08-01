// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { fonts } from './astro.fonts.mjs';

// Static output (the default): the whole tool is prerendered HTML; the only
// client JS is src/tool/main.ts, loaded by the tool page. Bookmark URLs are
// query-based (/separators/?icon=…&color=…), so the single prerendered
// /separators/ page serves every combination on any static host — no rewrites,
// no per-separator pages. See src/lib/bookmarkUrl.ts.
export default defineConfig({
  site: 'https://divii.de',
  // Defined once in astro.fonts.mjs and imported by the consuming site's own
  // config too, so the two builds can never declare different weights or subsets.
  fonts,
  vite: {
    plugins: [tailwindcss()],
  },
});
