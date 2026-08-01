import { bookmarkUrl, currentBookmark } from './bookmarkUrl';
import { safeHex } from './colors';
import { svgDataUri } from './svgDataUri';
import { normalizeHex, faviconSvg } from './faviconPaint';

// The separator shown as the page's default favicon. The favicon recolors with
// the selected color until the user picks a specific icon. The <link id="diviide-favicon">
// itself is created by the pre-paint bootstrap (src/components/PrePaintBootstrap.astro) —
// never hardcode an href in static HTML, or a bookmark URL served with it would
// re-associate the default icon over the bookmark's frozen favicon.
export const DEFAULT_SEPARATOR_ICON = 'lines-vertical-small';

// The favicon is generated on the fly: any hex works, no per-color files and no
// server. The color-agnostic shape templates are inlined by the pre-paint
// bootstrap (window.__diviideIconTemplates); this module reads that map, swaps
// `black` for the hex (faviconSvg, from faviconPaint.ts), and encodes the result
// as a data: URI. The inline bootstrap in PrePaintBootstrap.astro carries the one
// unavoidable copy of that paint step — it cannot import — so a bookmark opened
// cold and a live re-tint stay byte-identical only as long as those two agree;
// prePaintBootstrap.dom.test.ts executes the bootstrap and compares its output.
declare global {
  interface Window {
    __diviideIconTemplates?: Record<string, string>;
  }
}

// Color travels as a hex everywhere (URL, CSS, storage), so the favicon just
// needs a valid hex — no palette lookup and no name-vs-hex branch. The paint
// primitives live in faviconPaint.ts (import-free, so the plain-Node E2E
// verifier can share them instead of carrying its own copy) and are re-exported
// here so every existing caller keeps importing them from this module.
export { normalizeHex, faviconSvg };

// Last-resort shape so a missing template can never yield a broken favicon.
// Mirrors assets/icons/lines-vertical-small.svg (inlined for the same reason as
// LinesVerticalSmallIcon.astro) — keep the path data in sync. Exported so
// config-integrity.test.ts can compare it against that file directly instead of
// regexing the literal back out of this module's source.
export const FALLBACK_ICON_SVG =
  '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 5L9 19" stroke="black" stroke-width="2" stroke-linecap="round"/><path d="M15 5L15 19" stroke="black" stroke-width="2" stroke-linecap="round"/></svg>';

// The runtime accessor for the templates the pre-paint bootstrap inlined. The
// sole caller is faviconDataUri below, for the live re-tint.
export function getIconTemplate(iconName: string): string {
  const templates = window.__diviideIconTemplates ?? {};
  return (
    // Own-property lookup only, mirroring the bootstrap: an inherited
    // Object.prototype key must fall back, not shadow the default with a
    // non-string.
    (Object.hasOwn(templates, iconName) ? templates[iconName] : undefined) ??
    templates[DEFAULT_SEPARATOR_ICON] ??
    FALLBACK_ICON_SVG
  );
}

export function faviconDataUri(iconName: string, hex: string): string {
  return svgDataUri(faviconSvg(getIconTemplate(iconName), hex));
}

function getFaviconElement(): HTMLLinkElement {
  let favicon = document.getElementById('diviide-favicon') as HTMLLinkElement;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.id = 'diviide-favicon';
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    document.head.appendChild(favicon);
  }
  return favicon;
}

// `hex` is the separator color (a hex, e.g. "#e11d48"). Invalid input falls
// back to the brand default rather than a broken favicon.
export function setFavicon(iconName: string, hex: string): void {
  const favicon = getFaviconElement();
  favicon.href = faviconDataUri(iconName, safeHex(hex));
}

// Set URL without navigation (for favicon caching).
//
// The browser caches a bookmark's favicon against the URL the page is sitting on
// at capture time, so we park the page on the bookmark's own URL (see
// bookmarkUrl) during a drag and LEAVE it there afterwards — that gives the
// browser unhurried time to finish caching the dropped bookmark's favicon
// (restoring on dragend instead raced that capture and corrupted icons). The page
// is moved back off this URL later, just before the next color-change re-tint, by
// restoreUrlAfterSelect(). Without that, the re-tint would overwrite the cache
// for a saved bookmark's URL and flip its icon.
//
// Only the FIRST select of a sequence pushes a history entry; the rest replace it.
// The page is already parked by then, so pushing again would only deepen the
// stack: picking twenty separators in a row used to take twenty Back presses to
// leave the page. One push keeps Back meaning "return to the app", which is the
// only entry worth having. Either way the document's URL ends up the same, so
// favicon caching is untouched.
function setUrlForFavicon(iconName: string, color: string, replace: boolean): void {
  const url = bookmarkUrl(iconName, color);
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
}

// The app URL the page was on before selectFavicon() parked it on a bookmark
// URL, so we can restore it before the next re-tint touches the live favicon.
//
// This is stored on `window`, deliberately — not in a module variable, and not
// in sessionStorage — because the lifetime has to be exactly "this page
// session":
//   - A module variable resets to its initial value when a dev server hot-swaps
//     this module. If that happened while the page was parked on a bookmark URL,
//     the restore below would silently no-op and the next color-change re-tint
//     would bleed onto the saved bookmark's cached favicon.
//   - sessionStorage has the opposite problem: it survives a real navigation
//     within the tab. Opening a saved bookmark would then find a *stale* origin
//     left over from an earlier drag and wrongly un-park the freshly opened
//     bookmark page — re-tinting its frozen favicon to the default icon + latest
//     color.
// A property on `window` threads the needle: it survives an HMR module swap (same
// JS realm) but is fresh after a real page load/navigation (new realm) — which is
// exactly "did *this* page session park the URL?".
declare global {
  interface Window {
    __diviideParkedFrom?: string | null;
  }
}

// Update the URL and favicon together so the browser caches the right icon.
// Call this whenever an icon is dragged or clicked. The parked bookmark URL is
// restored later by restoreUrlAfterSelect(), just before the next re-tint.
export function selectFavicon(iconName: string, color: string): void {
  // Remember the real origin once per drag sequence so the re-tint can move the
  // page back. Never capture a bookmark URL as the origin: when a second icon is
  // dragged before any color change, the page is already parked on the first
  // bookmark's URL, and that must not become the "origin" we restore to.
  //
  // Being parked already is also exactly the condition for replacing rather than
  // pushing the URL below, so the two share one check.
  const parked = currentBookmark() !== null;
  if (!parked) {
    window.__diviideParkedFrom = location.pathname + location.search + location.hash;
  }
  setUrlForFavicon(iconName, color, parked);
  setFavicon(iconName, color);
}

// Restore the page URL away from a parked bookmark URL, so a subsequent live
// favicon re-tint (color change) can't bleed onto the saved bookmark's URL.
// Called right before the re-tint. Idempotent: it restores to the origin this
// page session remembered and is a no-op once that's cleared, or if this page
// session never parked the URL (e.g. the page was loaded by opening a saved
// bookmark — in which case the bookmark URL must be left intact and its frozen
// favicon preserved).
export function restoreUrlAfterSelect(): void {
  const before = window.__diviideParkedFrom ?? null;
  if (before !== null) {
    history.replaceState({}, '', before);
    window.__diviideParkedFrom = null;
  }
}
