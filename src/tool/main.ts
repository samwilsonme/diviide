// The tool's entire client runtime. The page itself is prerendered (grid,
// sidebar, counts all baked in at build), so this module only wires behavior:
// color selection, category/search filtering (including the "recent"
// pseudo-category), labels, the first-visit banner, theme + mobile drawer,
// keyboard shortcuts, and — the heart of the product — the drag-to-bookmark
// favicon contract (see lib/favicon.ts).
//
// No framework, no config fetch: everything the runtime needs is baked into the
// DOM as data attributes by the .astro components, so this file and the markup
// share one contract:
//   [data-swatch data-hex]                 color buttons (aria-pressed = selected)
//   [data-tile data-icon data-search data-category]  grid anchors
//   [data-category-btn data-category]      category buttons (aria-pressed = selected;
//                                          "recent" is the recents pseudo-category)
//   [data-recent-count], [data-recent-clear]  recents count badge + clear action
//   [data-search-input/-clear/-kbd]        search box internals
//   [data-no-results …]                    empty state
//   [data-label-*]                         label section (see src/tool/labels.ts)
//   [data-banner/-dismiss]                 first-visit banner
//   [data-theme-toggle], [data-menu-open], [data-menu], [data-sidebar],
//   [data-sidebar-home]                    mobile drawer (the sidebar node moves)
//   [data-grid-home]                       the grid's scroll pane (wheel routing)

import { DEFAULT_COLOR_HEX, accentHex, swatchHex } from '../lib/colors';
import { STORAGE_KEYS, readString, writeString, readJSON, writeJSON } from '../lib/storage';
import {
  DEFAULT_SEPARATOR_ICON,
  setFavicon,
  selectFavicon,
  restoreUrlAfterSelect,
  normalizeHex,
} from '../lib/favicon';
import { bookmarkUrl, currentBookmark } from '../lib/bookmarkUrl';
import { startSeparatorDrag } from '../lib/separatorDrag';
import { initColorPicker } from './colorPicker';
import { initLabels } from './labels';
import { $, $$ } from '../lib/dom';
import { wireDialog } from '../lib/dialog';

const MAX_RECENT = 50;

/**
 * Wire the tool's behavior to the current document. Returns a teardown that
 * removes every listener and cancels any pending frame or timer, so the runtime
 * can be started and stopped repeatedly against the same document — which is what
 * lets the DOM suites mount a fresh fixture per test instead of accumulating
 * document-level delegates across the whole file.
 */
export function initTool(): () => void {
  // One controller for every listener below (and for the ones initLabels and
  // initColorPicker register), so teardown is a single abort() rather than a
  // hand-maintained list of removeEventListener calls that can fall out of date.
  const controller = new AbortController();
  const { signal } = controller;

  // ---- palette (baked into the swatch buttons) ----------------------------
  const swatches = $$('button[data-swatch]');
  // The palette hexes (normalized) — used to decide which colors may theme the
  // site accent (accentHex). Custom colors from the URL are not in this set.
  const paletteHexes = new Set(swatches.map(swatchHex));

  // ---- state ---------------------------------------------------------------
  // Color is a hex everywhere: URL, CSS, storage. The palette name survives only
  // as the swatch tooltip. An invalid stored value falls back to the brand default.
  let color = normalizeHex(readString(STORAGE_KEYS.color, DEFAULT_COLOR_HEX)) ?? DEFAULT_COLOR_HEX;
  let category = 'all';
  let query = '';
  // Corrupted storage can hold any JSON shape; keep only a real string array so
  // one bad key can never crash the whole runtime.
  const storedRecent = readJSON<string[]>(STORAGE_KEYS.recent, []);
  let recent = Array.isArray(storedRecent) ? storedRecent.filter((n) => typeof n === 'string') : [];

  // The label section (text input and the Advanced decoration/preview) is a
  // self-contained module; it hands back dragLabel(), the decorated title the
  // browser should name a dropped bookmark with (empty when the input is blank).
  const { dragLabel } = initLabels(signal);

  // Opened from a saved bookmark (?icon=…&color=…): adopt the bookmark's color
  // as the selection (and persist it), exactly like picking it. The favicon was
  // already set from the query by the pre-paint bootstrap and must NOT be
  // re-tinted while the page sits on the bookmark URL — applyColor()'s guard
  // (currentBookmark()) handles that.
  const opened = currentBookmark();
  if (opened) {
    // Adopt the bookmark's color (any valid hex) as the selection and persist
    // it, so the page matches its already-pre-paint-set frozen favicon. An
    // invalid value is ignored (pre-paint fell back to the default too).
    const openedHex = normalizeHex(opened.color);
    if (openedHex) {
      color = openedHex;
      writeString(STORAGE_KEYS.color, color);
    }
  }

  // ---- color --------------------------------------------------------------
  // Selected on the attributes this runtime READS, not just [data-tile]. If one
  // is ever renamed in IconGrid.astro the grid comes back empty — loud and
  // immediate — instead of every tile yielding `undefined` inside a bookmark URL.
  // That is what makes the `!` reads below honest rather than the lie lib/dom.ts
  // exists to argue against.
  const gridTiles = $$<HTMLAnchorElement>(
    'a[data-tile][data-icon][data-search]',
    $('[data-grid]') ?? document
  );
  // Drop stored recents the grid can't show (icons renamed or removed since
  // they were saved), so the recents count never exceeds the visible tiles.
  const knownIcons = new Set(gridTiles.map((t) => t.dataset.icon!));
  recent = recent.filter((n) => knownIcons.has(n));

  // The cheap half of a color change: two CSS variable writes that repaint every
  // masked icon and accent surface at once. Split out because the Advanced
  // picker's live preview needs exactly this and nothing else on each pointer
  // frame (see initColorPicker below), while the expensive remainder coalesces.
  //
  // Color is a hex. It paints the icon as-is; the site accent only takes a
  // palette color, so custom/URL hexes fall back to the brand default
  // (accentHex) and never theme the whole page oddly.
  function paintColorVars(): void {
    const root = document.documentElement;
    root.style.setProperty('--icon-color', color);
    root.style.setProperty('--accent-live', accentHex(color, paletteHexes));
  }

  function applyColor(): void {
    paintColorVars();

    for (const b of swatches) b.setAttribute('aria-pressed', String(swatchHex(b) === color));

    // Keep every drag source's native href on the current color: with a label
    // set the drag is fully native and the browser uses the anchor's href.
    for (const a of gridTiles) {
      a.setAttribute('href', bookmarkUrl(a.dataset.icon!, color));
    }

    // Re-tint the live favicon (the default separator) to match, mirroring the
    // logo. A drag leaves the page parked on the dropped bookmark's own URL (so
    // the browser can finish caching that bookmark's favicon without a race).
    // Before re-tinting we MUST move the page back off that URL — the browser
    // caches a bookmark's favicon against its URL, so re-tinting while parked
    // there would overwrite the saved bookmark's icon with the default. The
    // guard skips the re-tint on any bookmark URL (e.g. a page opened by
    // clicking a saved bookmark), so its frozen favicon is never overwritten;
    // the live /separators/ page (no query) is not a bookmark URL, so it still
    // re-tints normally.
    restoreUrlAfterSelect();
    if (currentBookmark()) return;
    setFavicon(DEFAULT_SEPARATOR_ICON, color);
  }

  // The Advanced color picker: any change is just another color selection.
  // A wheel drag emits once per pointer frame, so the cheap live preview (the
  // two CSS vars) applies synchronously while the heavy remainder — the
  // storage write, every tile href, and the favicon re-tint (a fresh data URI
  // the browser re-decodes per assignment) — coalesces onto the next
  // animation frame. applyColor() runs whole there, so the favicon parking
  // guard is untouched.
  let pickerFrame = 0;
  const picker = initColorPicker(
    document,
    (hex) => {
      color = hex;
      paintColorVars();
      if (pickerFrame) return;
      pickerFrame = requestAnimationFrame(() => {
        pickerFrame = 0;
        writeString(STORAGE_KEYS.color, color);
        applyColor();
      });
    },
    signal
  );

  for (const b of swatches) {
    b.addEventListener(
      'click',
      () => {
        color = swatchHex(b);
        writeString(STORAGE_KEYS.color, color);
        applyColor();
        picker?.setColor(color);
      },
      { signal }
    );
  }

  // ---- category + search filtering -----------------------------------------
  const categoryButtons = $$('button[data-category-btn][data-category]');
  const recentCount = $('[data-recent-count]');
  const recentClear = $('[data-recent-clear]');
  const noResults = $('[data-no-results]');
  const noResultsTitle = $('[data-no-results-title]');
  const noResultsMessage = $('[data-no-results-message]');
  const clearSearchBtn = $('[data-clear-search-btn]');
  const resetCategoryBtn = $('[data-reset-category-btn]');
  const searchInput = $<HTMLInputElement>('input[data-search-input]');
  const searchClear = $('[data-search-clear]');
  const searchKbd = $('[data-search-kbd]');

  function applyFilter(): void {
    const q = query.toLowerCase().trim();
    let visible = 0;
    for (const tile of gridTiles) {
      const icon = tile.dataset.icon!;
      const inCategory =
        category === 'all' ||
        (category === 'recent' ? recent.includes(icon) : tile.dataset.category === category);
      const match = inCategory && (!q || tile.dataset.search!.includes(q));
      tile.hidden = !match;
      if (match) visible++;
      // The recents view reads newest-first. The grid is prerendered in catalog
      // order, so CSS order re-sorts the visible tiles without touching the DOM.
      if (category === 'recent' && match) tile.style.order = String(recent.indexOf(icon));
      else tile.style.removeProperty('order');
    }

    for (const b of categoryButtons) {
      b.setAttribute('aria-pressed', String(b.dataset.category === category));
    }

    // An empty recents view (no history yet) gets its own explainer copy; every
    // other empty state keeps the search/category wording.
    const recentsEmpty = category === 'recent' && recent.length === 0 && !query.trim();
    if (noResults) noResults.hidden = visible > 0;
    if (noResultsTitle) {
      noResultsTitle.textContent = recentsEmpty
        ? 'No recent separators yet'
        : 'No separators found';
    }
    if (noResultsMessage) {
      noResultsMessage.textContent = query.trim()
        ? `Nothing matches "${query.trim()}".`
        : recentsEmpty
          ? 'Drag or click any separator and it will show up here.'
          : 'Try another category.';
    }
    if (clearSearchBtn) clearSearchBtn.hidden = !query.trim();
    if (resetCategoryBtn) resetCategoryBtn.hidden = category === 'all';
    if (recentClear) recentClear.hidden = !(category === 'recent' && recent.length > 0);
  }

  for (const b of categoryButtons) {
    b.addEventListener(
      'click',
      () => {
        category = b.dataset.category!;
        applyFilter();
      },
      { signal }
    );
  }

  function setQuery(value: string): void {
    query = value;
    if (searchInput && searchInput.value !== value) searchInput.value = value;
    if (searchClear) searchClear.hidden = value === '';
    if (searchKbd) searchKbd.hidden = value !== '';
    applyFilter();
  }

  searchInput?.addEventListener('input', () => setQuery(searchInput.value), { signal });
  searchClear?.addEventListener('click', () => setQuery(''), { signal });
  clearSearchBtn?.addEventListener('click', () => setQuery(''), { signal });
  resetCategoryBtn?.addEventListener(
    'click',
    () => {
      category = 'all';
      applyFilter();
    },
    { signal }
  );

  // Keyboard: "/" focuses search (unless typing elsewhere), Escape clears it.
  function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      // A held modifier means a browser/extension shortcut (e.g. Cmd+/), not a
      // request to search — leave those alone.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/' && searchInput && !isInputFocused()) {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === 'Escape' && searchInput && document.activeElement === searchInput) {
        setQuery('');
        searchInput.blur();
      }
    },
    { signal }
  );

  // ---- recents --------------------------------------------------------------
  // Recents live in the category rail as the "recent" pseudo-category; the
  // count badge is the only extra UI to keep in sync.
  const syncRecentCount = (): void => {
    if (recentCount) recentCount.textContent = String(recent.length);
  };

  function addRecent(icon: string): void {
    recent = [icon, ...recent.filter((n) => n !== icon)].slice(0, MAX_RECENT);
    writeJSON(STORAGE_KEYS.recent, recent);
    syncRecentCount();
    // Keep the recents view live while the user is looking at it.
    if (category === 'recent') applyFilter();
  }

  recentClear?.addEventListener(
    'click',
    () => {
      recent = [];
      writeJSON(STORAGE_KEYS.recent, recent);
      syncRecentCount();
      applyFilter();
    },
    { signal }
  );

  // ---- the drag/click contract (event delegation over every drag source) ----
  // Resolve the tile anchor an event landed on, or null for events outside one.
  const tileFromEvent = (e: Event): HTMLAnchorElement | null => {
    // Same attribute-bearing selector as gridTiles: an event on a tile that lost
    // its data-icon resolves to null rather than a drag carrying `undefined`.
    const tile = e.target instanceof Element ? e.target.closest('a[data-tile][data-icon]') : null;
    return tile instanceof HTMLAnchorElement ? tile : null;
  };

  document.addEventListener(
    'dragstart',
    (e) => {
      const tile = tileFromEvent(e);
      if (!tile) return;
      startSeparatorDrag(e, tile, tile.dataset.icon!, color, dragLabel());
    },
    { signal }
  );

  document.addEventListener(
    'dragend',
    (e) => {
      const tile = tileFromEvent(e);
      if (!tile) return;
      // Track in recents only after the drag completes to avoid layout shift. The
      // URL stays parked on the bookmark URL (restored just before the next
      // color-change re-tint in applyColor) so the browser can finish caching the
      // dropped bookmark's favicon first.
      addRecent(tile.dataset.icon!);
    },
    { signal }
  );

  document.addEventListener(
    'click',
    (e) => {
      const tile = tileFromEvent(e);
      if (!tile) return;
      // A modified click (Cmd/Ctrl/Shift/Alt) asks the browser to open the
      // tile's bookmark URL in a new tab/window — same as middle-click, which
      // never reaches this handler. Leave it native instead of hijacking it
      // into a favicon select.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // A click sets the favicon once and leaves the page parked on the bookmark
      // URL; no restoreUrlAfterSelect() is needed here because nothing re-tints on
      // a click. The next applyColor() restores the live URL before it re-tints.
      selectFavicon(tile.dataset.icon!, color);
      addRecent(tile.dataset.icon!);
    },
    { signal }
  );

  // ---- first-visit banner ----------------------------------------------------
  const banner = $('[data-banner]');
  if (banner && readString(STORAGE_KEYS.visited, '') === '') {
    banner.hidden = false;
    $('[data-banner-dismiss]', banner)?.addEventListener(
      'click',
      () => {
        writeString(STORAGE_KEYS.visited, 'true');
        banner.hidden = true;
      },
      { signal }
    );
  }

  // ---- sidebar: mobile drawer ------------------------------------------------
  const mdQuery = window.matchMedia('(min-width: 48rem)');
  const drawer = $<HTMLDialogElement>('dialog[data-menu]');
  const drawerSlot = drawer ? $('[data-drawer-slot]', drawer) : null;
  const sidebarHome = $('[data-sidebar-home]');
  const sidebar = $('[data-sidebar]');

  $('[data-menu-open]')?.addEventListener(
    'click',
    () => {
      if (!drawer || !drawerSlot || !sidebar) return;
      drawerSlot.appendChild(sidebar);
      drawer.showModal();
    },
    { signal }
  );
  // The drawer holds the real sidebar node while open, so closing must put it
  // back wherever it came from — however the close happened.
  if (drawer) {
    wireDialog(drawer, {
      closeSelector: '[data-menu-close]',
      signal,
      onClose: () => {
        if (sidebar && sidebarHome) sidebarHome.appendChild(sidebar);
      },
    });
  }
  // If the viewport crosses to desktop while the drawer is open, put the
  // sidebar back in the aside.
  mdQuery.addEventListener(
    'change',
    (e) => {
      if (e.matches) drawer?.close();
    },
    { signal }
  );

  // ---- desktop wheel routing -------------------------------------------------
  // At md+ the body is locked (md:overflow-hidden via the page's bodyClass) and
  // the two panes own all scrolling. A wheel over the header, footer, column
  // gap, or outer margins targets neither pane, so route it by which side of
  // the grid pane's left edge the pointer is on: left scrolls the sidebar,
  // right scrolls the grid. Events already inside a pane keep native scrolling.
  const gridHome = $('[data-grid-home]');
  window.addEventListener(
    'wheel',
    (e) => {
      if (!mdQuery.matches || !sidebarHome || !gridHome) return;
      if (e.ctrlKey) return; // trackpad pinch-zoom, not a scroll
      const t = e.target instanceof Node ? e.target : null;
      if (t && (sidebarHome.contains(t) || gridHome.contains(t))) return;
      e.preventDefault();
      const pane = e.clientX < gridHome.getBoundingClientRect().left ? sidebarHome : gridHome;
      // deltaMode: 0 = pixels, 1 = lines, 2 = pages.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? pane.clientHeight : 1;
      pane.scrollTop += e.deltaY * unit;
    },
    { passive: false, signal }
  );

  // (The theme toggle is wired by Header.astro — present on every page, not
  // just the tool.)

  // ---- initial paint -----------------------------------------------------------
  applyColor();
  picker?.setColor(color);
  // Seed the query from the input rather than assuming it is empty: Firefox
  // restores text-input values across reload/session restore, and the filter,
  // clear button, and kbd hint must match whatever is visibly in the box.
  setQuery(searchInput?.value ?? '');
  syncRecentCount();

  // Teardown. abort() unhooks every listener registered with the signal, here and
  // in initLabels/initColorPicker; the pending picker frame is cancelled by hand
  // because AbortSignal does not cover requestAnimationFrame, and a frame landing
  // after teardown would write storage and re-tint the favicon for a document
  // nobody is looking at any more.
  return () => {
    controller.abort();
    if (pickerFrame) {
      cancelAnimationFrame(pickerFrame);
      pickerFrame = 0;
    }
  };
}
