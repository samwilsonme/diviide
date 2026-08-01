// The URL a dragged separator bookmark points at: /separators/?icon={icon}&color={color}
//
// One prerendered page (src/pages/separators/index.astro) serves every
// combination — query strings never hit the file system on a static host, so no
// per-separator pages, rewrites, or SPA fallback are needed anywhere. Browsers
// key a bookmark's favicon by the full URL *including* the query (verified
// against Chrome's Favicons DB), so each combination is still a unique,
// permanently cacheable URL: creating new separators can never touch an
// existing bookmark.
//
// `color` is a bare hex ("e11d48") — color travels as hex everywhere now. The
// favicon is generated on the fly from it (see src/lib/favicon.ts), so any hex
// is a valid, cacheable bookmark URL without a stored file.
//
// The live tool page is the same path *without* the query, so it is not a
// bookmark URL: parseBookmarkUrl() returns null there and the live favicon
// re-tint stays allowed (see the guard in src/tool/main.ts). With the query
// present the page must keep its frozen favicon — never re-tint while parked on
// a bookmark URL.

export const TOOL_PATH = '/separators/';

export function bookmarkUrl(icon: string, color: string): string {
  // Strip a leading '#' from a hex so the URL is a clean ?color=e11d48 (palette
  // names never start with '#', so this is a no-op for them).
  const colorParam = color.replace(/^#/, '');
  return `${TOOL_PATH}?icon=${encodeURIComponent(icon)}&color=${encodeURIComponent(colorParam)}`;
}

export interface BookmarkRef {
  icon: string;
  color: string;
}

// Parse a location-like {pathname, search} into a bookmark reference, or null
// when the URL isn't a bookmark URL (wrong path, or either param missing).
// Accepts the path with and without the trailing slash — static hosts differ in
// whether they redirect /separators to /separators/.
export function parseBookmarkUrl(pathname: string, search: string): BookmarkRef | null {
  if (pathname !== TOOL_PATH && pathname !== TOOL_PATH.slice(0, -1)) return null;
  const params = new URLSearchParams(search);
  const icon = params.get('icon');
  const color = params.get('color');
  if (!icon || !color) return null;
  return { icon, color };
}

// Convenience for the common call sites that check the current page.
export function currentBookmark(): BookmarkRef | null {
  return parseBookmarkUrl(window.location.pathname, window.location.search);
}
