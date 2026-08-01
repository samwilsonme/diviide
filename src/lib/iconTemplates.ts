// Color-agnostic source SVG per icon, keyed by icon name. `black` is the
// placeholder the favicon swaps for a hex at render time (see faviconDataUri in
// favicon.ts). This is the only finite dimension: one shape each, not shapes x
// colors.
//
// BUILD-TIME ONLY. Two prerender consumers, no client import:
//   - the pre-paint bootstrap (via Base.astro) inlines only the subset a page
//     needs into the HTML (window.__diviideIconTemplates) for the favicon; the
//     client runtime (favicon.ts) reads that map off `window`.
//   - the tool components (IconGrid, LabelSection) bake each shape into its
//     tile as a data-URI CSS mask (see svgDataUri.ts), so the grid costs no
//     icon requests.
//
import { roundIconSvg } from './faviconPaint';

// import.meta.glob resolves at build (Vite), so this works in dev and build with
// no generated file to keep in sync. `?raw` returns each SVG as a string.
const modules = import.meta.glob('../../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Keyed by icon name, with every shape rounded through the shared transform in
// faviconPaint.ts — the one choke point the bootstrap, the tile masks, the
// favicon, and the E2E verifier all read, so their output cannot diverge.
export const iconTemplates: Record<string, string> = {};
for (const [path, raw] of Object.entries(modules)) {
  const name = path.slice(path.lastIndexOf('/') + 1, -'.svg'.length);
  iconTemplates[name] = roundIconSvg(raw as string);
}
