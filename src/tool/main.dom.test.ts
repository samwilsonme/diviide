// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initTool } from './main';
import { DEFAULT_COLOR_HEX } from '../lib/colors';
import { DEFAULT_SEPARATOR_ICON, faviconDataUri } from '../lib/favicon';
import { bookmarkUrl } from '../lib/bookmarkUrl';
import { STORAGE_KEYS, writeJSON, writeString } from '../lib/storage';

// Integration suite over the whole tool runtime: real lib modules (each unit
// tested on its own), a fixture mirroring the data-* contract documented at
// the top of main.ts, and only environment stubs (no vi.mock).
//
// Every test starts the runtime through start(), which keeps the teardown
// initTool() returns and runs it in afterEach. Without that, each initTool()
// left its document-level delegates registered for the rest of the file, so a
// stale listener from an earlier test could act on a later test's events and
// assertions had to be written around it.
//
// The color-selection cases are the executable spec for the favicon
// invariant (see CLAUDE.md): never re-tint the live favicon while the page
// sits on a bookmark URL.

const TEAL = '#0d9488';
const ROSE = '#e11d48';

function mount(): void {
  document.body.innerHTML = `
    <button data-swatch data-hex="${DEFAULT_COLOR_HEX}" aria-pressed="false"></button>
    <button data-swatch data-hex="${TEAL}" aria-pressed="false"></button>
    <button data-swatch data-hex="${ROSE}" aria-pressed="false"></button>
    <div data-grid-home>
      <div data-grid>
        <a data-tile data-icon="pipe" data-search="pipe bar line" data-category="classic" title="Pipe" href="#"><span data-separator></span><span data-label></span></a>
        <a data-tile data-icon="dot" data-search="dot point" data-category="classic" title="Dot" href="#"><span data-separator></span><span data-label></span></a>
        <a data-tile data-icon="arrow-right" data-search="arrow right" data-category="arrows" title="Arrow right" href="#"><span data-separator></span><span data-label></span></a>
      </div>
    </div>
    <button data-category-btn data-category="all" aria-pressed="true"></button>
    <button data-category-btn data-category="classic" aria-pressed="false"></button>
    <button data-category-btn data-category="arrows" aria-pressed="false"></button>
    <button data-category-btn data-category="numbers" aria-pressed="false"></button>
    <input data-search-input />
    <button data-search-clear hidden></button>
    <kbd data-search-kbd></kbd>
    <div data-no-results hidden>
      <span data-no-results-title></span>
      <span data-no-results-message></span>
      <button data-clear-search-btn hidden></button>
      <button data-reset-category-btn hidden></button>
    </div>
    <div data-sidebar-home>
      <div data-sidebar>
        <button data-recent-clear hidden></button>
        <button data-category-btn data-category="recent" aria-pressed="false">
          Recently used <span data-recent-count>0</span>
        </button>
      </div>
    </div>
    <div data-banner hidden><button data-banner-dismiss></button></div>
    <!-- The label input only: initLabels presence-checks every other control, and
         the tiles above already carry the [data-label] spans a labeled drag reads. -->
    <input data-label-input />
    <button data-menu-open></button>
    <dialog data-menu>
      <button data-menu-close></button>
      <div data-drawer-slot></div>
    </dialog>
  `;

  // jsdom implements neither showModal nor close on <dialog>; the drawer only
  // needs them to move the sidebar node and fire 'close', so stub the minimum.
  const drawer = $<HTMLDialogElement>('dialog[data-menu]');
  drawer.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  drawer.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

const iconColor = () => document.documentElement.style.getPropertyValue('--icon-color');
const faviconHref = () =>
  (document.getElementById('diviide-favicon') as HTMLLinkElement | null)?.href ?? null;
const pageUrl = () => location.pathname + location.search;
const tile = (icon: string) => $<HTMLAnchorElement>(`[data-grid] a[data-icon="${icon}"]`);
const pressedSwatch = () => $<HTMLElement>('button[data-swatch][aria-pressed="true"]')?.dataset.hex;

// Overridable per test (set before start()) to simulate crossing the md+
// breakpoint for the desktop-only wheel-routing suite below.
let mdMatches = false;

// The live runtime's teardown, plus the environment stubs to restore. Both are
// per-test: the stubs overwrite prototype/window members that other suites in the
// same process would otherwise inherit.
let teardown: (() => void) | undefined;
let realGetContext: typeof HTMLCanvasElement.prototype.getContext;
let realMatchMedia: typeof window.matchMedia;

function start(): void {
  teardown = initTool();
}

beforeEach(() => {
  localStorage.clear();
  mdMatches = false;
  // jsdom has no canvas (initLabels' fit meter) and no matchMedia (the drawer's
  // desktop-crossing listener, also gating wheel routing) — stub both quietly.
  realGetContext = HTMLCanvasElement.prototype.getContext;
  realMatchMedia = window.matchMedia;
  HTMLCanvasElement.prototype.getContext = () => null;
  window.matchMedia = (() => ({
    matches: mdMatches,
    addEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  // Reset per-page-session favicon state: the parked-URL marker, the template
  // map, and the <link> the previous test's re-tint created in <head>.
  window.__diviideParkedFrom = null;
  window.__diviideIconTemplates = {
    [DEFAULT_SEPARATOR_ICON]: '<svg><path stroke="black" d="M9 5v14"/></svg>',
    pipe: '<svg><path stroke="black" d="M12 4v16"/></svg>',
    dot: '<svg><circle fill="black" r="4"/></svg>',
  };
  document.getElementById('diviide-favicon')?.remove();
  history.replaceState({}, '', '/separators/');
  mount();
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
  HTMLCanvasElement.prototype.getContext = realGetContext;
  window.matchMedia = realMatchMedia;
});

describe('color selection and the favicon invariant', () => {
  it('paints the persisted color on load: CSS vars, pressed swatch, tile hrefs', () => {
    writeString(STORAGE_KEYS.color, TEAL);
    start();
    expect(iconColor()).toBe(TEAL);
    expect(pressedSwatch()).toBe(TEAL);
    for (const a of $$<HTMLAnchorElement>('[data-grid] a[data-tile]')) {
      expect(a.getAttribute('href')).toBe(bookmarkUrl(a.dataset.icon!, TEAL));
    }
    expect(faviconHref()).toBe(faviconDataUri(DEFAULT_SEPARATOR_ICON, TEAL));
  });

  it('falls back to the default color when the stored value is not a hex', () => {
    writeString(STORAGE_KEYS.color, 'teal');
    start();
    expect(iconColor()).toBe(DEFAULT_COLOR_HEX);
    expect(pressedSwatch()).toBe(DEFAULT_COLOR_HEX);
  });

  it('clicking a swatch persists the hex, re-tints the live favicon, and rewrites hrefs', () => {
    start();
    $<HTMLElement>(`button[data-swatch][data-hex="${ROSE}"]`).click();
    expect(localStorage.getItem(STORAGE_KEYS.color)).toBe(ROSE);
    expect(iconColor()).toBe(ROSE);
    expect(faviconHref()).toBe(faviconDataUri(DEFAULT_SEPARATOR_ICON, ROSE));
    expect(tile('pipe').getAttribute('href')).toBe(bookmarkUrl('pipe', ROSE));
    // A plain color change never parks the page on a bookmark URL.
    expect(pageUrl()).toBe('/separators/');
  });

  it('leaves a modified click (new-tab intent) to the browser instead of hijacking it', () => {
    writeString(STORAGE_KEYS.color, TEAL);
    start();
    // Record whether the runtime prevented the click, then prevent it
    // ourselves purely to stop jsdom trying to navigate (this last-registered
    // listener runs after the runtime's delegate).
    let preventedByRuntime: boolean | null = null;
    document.addEventListener(
      'click',
      (ev) => {
        preventedByRuntime = ev.defaultPrevented;
        ev.preventDefault();
      },
      { once: true }
    );
    tile('pipe').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
    );
    expect(preventedByRuntime).toBe(false);
    // No favicon select happened: the page never parked on the bookmark URL.
    expect(pageUrl()).toBe('/separators/');
  });

  it('degrades an invalid swatch data-hex to the brand default instead of crashing', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button data-swatch data-hex="tealish" aria-pressed="false"></button>'
    );
    start();
    $<HTMLElement>('button[data-swatch][data-hex="tealish"]').click();
    expect(iconColor()).toBe(DEFAULT_COLOR_HEX);
    expect(localStorage.getItem(STORAGE_KEYS.color)).toBe(DEFAULT_COLOR_HEX);
    expect(tile('pipe').getAttribute('href')).toBe(bookmarkUrl('pipe', DEFAULT_COLOR_HEX));
  });

  it('clicking a tile parks the page on the bookmark URL and freezes that favicon', () => {
    writeString(STORAGE_KEYS.color, TEAL);
    start();
    tile('pipe').click();
    expect(pageUrl()).toBe(bookmarkUrl('pipe', TEAL));
    expect(faviconHref()).toBe(faviconDataUri('pipe', TEAL));
  });

  it('a color change after a tile select restores the URL off the bookmark before re-tinting', () => {
    start();
    tile('pipe').click();
    expect(pageUrl()).toBe(bookmarkUrl('pipe', DEFAULT_COLOR_HEX));
    $<HTMLElement>(`button[data-swatch][data-hex="${TEAL}"]`).click();
    // Back on the live tool URL, so the re-tint cannot bleed onto the saved
    // bookmark's cached favicon.
    expect(pageUrl()).toBe('/separators/');
    expect(faviconHref()).toBe(faviconDataUri(DEFAULT_SEPARATOR_ICON, TEAL));
  });

  it('opened from a saved bookmark: adopts the color but never re-tints the frozen favicon', () => {
    history.replaceState({}, '', '/separators/?icon=pipe&color=112233');
    start();
    expect(iconColor()).toBe('#112233');
    expect(localStorage.getItem(STORAGE_KEYS.color)).toBe('#112233');
    // The pre-paint bootstrap owns the favicon on a bookmark URL; the runtime
    // must not create or touch the link while parked there.
    expect(faviconHref()).toBeNull();
    expect(pageUrl()).toBe('/separators/?icon=pipe&color=112233');
  });

  it('ignores an invalid ?color= on a bookmark URL and keeps the stored color', () => {
    writeString(STORAGE_KEYS.color, TEAL);
    history.replaceState({}, '', '/separators/?icon=pipe&color=notahex');
    start();
    expect(iconColor()).toBe(TEAL);
    expect(localStorage.getItem(STORAGE_KEYS.color)).toBe(TEAL);
    expect(faviconHref()).toBeNull();
  });
});

describe('category and search filtering', () => {
  const visibleIcons = () =>
    $$<HTMLAnchorElement>('[data-grid] a[data-tile]')
      .filter((a) => !a.hidden)
      .map((a) => a.dataset.icon);

  it('a category button hides non-matching tiles and moves aria-pressed', () => {
    start();
    $<HTMLElement>('button[data-category-btn][data-category="classic"]').click();
    expect(visibleIcons()).toEqual(['pipe', 'dot']);
    expect(
      $('button[data-category-btn][data-category="classic"]').getAttribute('aria-pressed')
    ).toBe('true');
    expect($('button[data-category-btn][data-category="all"]').getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect($('[data-reset-category-btn]').hidden).toBe(false);
  });

  it('search filters on data-search and the clear affordances restore every tile', () => {
    start();
    const input = $<HTMLInputElement>('input[data-search-input]');
    input.value = 'arrow';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visibleIcons()).toEqual(['arrow-right']);
    expect($('[data-search-clear]').hidden).toBe(false);
    expect($('[data-search-kbd]').hidden).toBe(true);
    $<HTMLElement>('[data-search-clear]').click();
    expect(visibleIcons()).toEqual(['pipe', 'dot', 'arrow-right']);
    expect($('[data-search-kbd]').hidden).toBe(false);
  });

  it('shows a query-specific empty state, and a category one for an empty category', () => {
    start();
    const input = $<HTMLInputElement>('input[data-search-input]');
    input.value = 'zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect($('[data-no-results]').hidden).toBe(false);
    expect($('[data-no-results-message]').textContent).toBe('Nothing matches "zzz".');
    expect($('[data-clear-search-btn]').hidden).toBe(false);

    $<HTMLElement>('[data-clear-search-btn]').click();
    expect($('[data-no-results]').hidden).toBe(true);

    $<HTMLElement>('button[data-category-btn][data-category="numbers"]').click();
    expect($('[data-no-results]').hidden).toBe(false);
    expect($('[data-no-results-message]').textContent).toBe('Try another category.');
    $<HTMLElement>('[data-reset-category-btn]').click();
    expect($('[data-no-results]').hidden).toBe(true);
    expect(visibleIcons()).toEqual(['pipe', 'dot', 'arrow-right']);
  });

  it('seeds the query from a restored input value at init (Firefox session restore)', () => {
    $<HTMLInputElement>('input[data-search-input]').value = 'arrow';
    start();
    expect(tile('arrow-right').hidden).toBe(false);
    expect(tile('pipe').hidden).toBe(true);
    expect($('[data-search-clear]').hidden).toBe(false);
    expect($('[data-search-kbd]').hidden).toBe(true);
  });

  it('"/" focuses search and Escape clears and blurs it', () => {
    start();
    const input = $<HTMLInputElement>('input[data-search-input]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(input);
    input.value = 'dot';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input.value).toBe('');
    expect(document.activeElement).not.toBe(input);
  });

  it('does not steal "/" while the visitor is typing in a field', () => {
    // The whole point of the isInputFocused guard, and nothing exercised it: a "/"
    // typed into the label input must reach the input, not re-focus search.
    start();
    const label = $<HTMLInputElement>('input[data-label-input]');
    label.focus();

    const ev = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    label.dispatchEvent(ev);

    expect(document.activeElement).toBe(label);
    // preventDefault would swallow the character before the field received it.
    expect(ev.defaultPrevented).toBe(false);
  });

  it('leaves "/" alone when a modifier is held', () => {
    // Cmd+/ and Ctrl+/ belong to the browser or an extension, not to search.
    start();
    for (const mods of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
      document.body.focus();
      const ev = new KeyboardEvent('keydown', {
        key: '/',
        bubbles: true,
        cancelable: true,
        ...mods,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented, JSON.stringify(mods)).toBe(false);
    }
  });
});

describe('recents category', () => {
  const storedRecent = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.recent) ?? '[]');
  const recentBtn = () => $<HTMLElement>('button[data-category-btn][data-category="recent"]');
  const count = () => $('[data-recent-count]').textContent;
  const visibleIcons = () =>
    $$<HTMLAnchorElement>('[data-grid] a[data-tile]')
      .filter((a) => !a.hidden)
      .map((a) => a.dataset.icon);

  it('selecting the category shows only recents, ordered newest-first via CSS order', () => {
    writeJSON(STORAGE_KEYS.recent, ['dot', 'pipe']);
    start();
    expect(count()).toBe('2');
    recentBtn().click();
    expect(recentBtn().getAttribute('aria-pressed')).toBe('true');
    expect(visibleIcons()).toEqual(['pipe', 'dot']);
    expect(tile('arrow-right').hidden).toBe(true);
    // Newest first: 'dot' was used last, so it sorts before 'pipe'.
    expect(tile('dot').style.order).toBe('0');
    expect(tile('pipe').style.order).toBe('1');
    // Leaving the view drops the CSS order again.
    $<HTMLElement>('button[data-category-btn][data-category="all"]').click();
    expect(tile('dot').style.order).toBe('');
  });

  it('prunes stored recents the grid no longer has, so the count matches the tiles', () => {
    writeJSON(STORAGE_KEYS.recent, ['ghost', 'pipe']);
    start();
    expect(count()).toBe('1');
  });

  it('a tile select moves its icon to the front without duplicates and updates the count', () => {
    start();
    tile('pipe').click();
    tile('dot').click();
    tile('pipe').click();
    expect(storedRecent()).toEqual(['pipe', 'dot']);
    expect(count()).toBe('2');
  });

  it('dragend on a tile records it in recents', () => {
    start();
    tile('dot').dispatchEvent(new Event('dragend', { bubbles: true }));
    expect(storedRecent()).toEqual(['dot']);
    expect(count()).toBe('1');
  });

  it('keeps the recents view live: a new use appears at the front while selected', () => {
    writeJSON(STORAGE_KEYS.recent, ['pipe']);
    start();
    recentBtn().click();
    expect(tile('dot').hidden).toBe(true);
    tile('dot').dispatchEvent(new Event('dragend', { bubbles: true }));
    expect(tile('dot').hidden).toBe(false);
    expect(tile('dot').style.order).toBe('0');
    expect(tile('pipe').style.order).toBe('1');
  });

  it('search filters within the recents view', () => {
    writeJSON(STORAGE_KEYS.recent, ['pipe', 'dot']);
    start();
    recentBtn().click();
    const input = $<HTMLInputElement>('input[data-search-input]');
    input.value = 'dot';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visibleIcons()).toEqual(['dot']);
  });

  it('persists at most 50 recents', () => {
    const grid = $('[data-grid]');
    for (let i = 0; i < 50; i++) {
      grid.insertAdjacentHTML(
        'beforeend',
        `<a data-tile data-icon="icon-${i}" data-search="icon" data-category="classic" title="Icon ${i}" href="#"><span data-separator></span><span data-label></span></a>`
      );
    }
    writeJSON(
      STORAGE_KEYS.recent,
      Array.from({ length: 50 }, (_, i) => `icon-${i}`)
    );
    start();
    expect(count()).toBe('50');
    tile('pipe').click();
    expect(storedRecent()).toHaveLength(50);
    expect(storedRecent()[0]).toBe('pipe');
  });

  it('survives a corrupted recent blob (wrong JSON shape) and starts empty', () => {
    // Valid JSON, wrong shape: must not crash initTool, just yield no recents.
    localStorage.setItem(STORAGE_KEYS.recent, '{"not":"an array"}');
    start();
    expect(count()).toBe('0');
  });

  it('drops non-string entries from a persisted recent list', () => {
    localStorage.setItem(STORAGE_KEYS.recent, '["pipe", 5, null, "dot"]');
    start();
    expect(count()).toBe('2');
  });

  it('shows the recents explainer as the empty state, with the category escape hatch', () => {
    start();
    recentBtn().click();
    expect($('[data-no-results]').hidden).toBe(false);
    expect($('[data-no-results-title]').textContent).toBe('No recent separators yet');
    expect($('[data-no-results-message]').textContent).toBe(
      'Drag or click any separator and it will show up here.'
    );
    $<HTMLElement>('[data-reset-category-btn]').click();
    expect($('[data-no-results]').hidden).toBe(true);
    expect($('[data-no-results-title]').textContent).toBe('No separators found');
  });

  it('the clear action shows only in a non-empty recents view, and clears everything', () => {
    writeJSON(STORAGE_KEYS.recent, ['pipe', 'dot']);
    start();
    expect($('[data-recent-clear]').hidden).toBe(true);
    recentBtn().click();
    expect($('[data-recent-clear]').hidden).toBe(false);
    $<HTMLElement>('[data-recent-clear]').click();
    expect(storedRecent()).toEqual([]);
    expect(count()).toBe('0');
    expect($('[data-recent-clear]').hidden).toBe(true);
    expect($('[data-no-results-title]').textContent).toBe('No recent separators yet');
  });
});

describe('first-visit banner', () => {
  it('shows on a first visit and dismiss persists', () => {
    start();
    const banner = $('[data-banner]');
    expect(banner.hidden).toBe(false);
    $<HTMLElement>('[data-banner-dismiss]').click();
    expect(banner.hidden).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.visited)).toBe('true');
  });

  it('stays hidden on a return visit', () => {
    writeString(STORAGE_KEYS.visited, 'true');
    start();
    expect($('[data-banner]').hidden).toBe(true);
  });
});

describe('desktop wheel routing', () => {
  // A wheel event outside both panes (header, footer, column gap, outer
  // margins) is routed by which side of the grid pane's left edge the pointer
  // is on. Stub the grid pane's geometry so clientX comparisons are
  // deterministic under jsdom (no real layout).
  function stubGridLeft(left: number): void {
    $('[data-grid-home]').getBoundingClientRect = () =>
      ({
        left,
        right: left + 400,
        top: 0,
        bottom: 600,
        width: 400,
        height: 600,
        x: left,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;
  }

  function wheel(init: WheelEventInit): WheelEvent {
    return new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120, ...init });
  }

  // These assert both halves of the contract: which pane scrolled, and whether
  // the runtime claimed the event. defaultPrevented is only meaningful because
  // afterEach tears the runtime down — while listeners accumulated across this
  // file, a stale one could preventDefault a later test's event and the flag said
  // nothing about the code under test.

  it('routes a wheel event left of the grid pane to the sidebar pane', () => {
    mdMatches = true;
    start();
    stubGridLeft(300);
    const ev = wheel({ clientX: 100 });
    window.dispatchEvent(ev);
    expect($('[data-sidebar-home]').scrollTop).toBe(120);
    expect($('[data-grid-home]').scrollTop).toBe(0);
    // The runtime owns this scroll, so the browser must not also scroll the page.
    expect(ev.defaultPrevented).toBe(true);
  });

  it('routes a wheel event over the grid pane to the grid pane', () => {
    mdMatches = true;
    start();
    stubGridLeft(300);
    const ev = wheel({ clientX: 500 });
    window.dispatchEvent(ev);
    expect($('[data-grid-home]').scrollTop).toBe(120);
    expect($('[data-sidebar-home]').scrollTop).toBe(0);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('leaves a pinch-zoom wheel event (ctrlKey) untouched', () => {
    mdMatches = true;
    start();
    stubGridLeft(300);
    const ev = wheel({ clientX: 100, ctrlKey: true });
    window.dispatchEvent(ev);
    expect($('[data-sidebar-home]').scrollTop).toBe(0);
    expect($('[data-grid-home]').scrollTop).toBe(0);
    // Pinch-zoom must stay the browser's: claiming it would break zooming.
    expect(ev.defaultPrevented).toBe(false);
  });

  it('leaves a wheel event already inside a pane to native scrolling', () => {
    mdMatches = true;
    start();
    stubGridLeft(300);
    $('[data-grid-home]').dispatchEvent(wheel({ clientX: 100 }));
    expect($('[data-grid-home]').scrollTop).toBe(0);
    expect($('[data-sidebar-home]').scrollTop).toBe(0);
  });

  it('does nothing below the desktop breakpoint', () => {
    mdMatches = false;
    start();
    stubGridLeft(300);
    window.dispatchEvent(wheel({ clientX: 100 }));
    expect($('[data-sidebar-home]').scrollTop).toBe(0);
    expect($('[data-grid-home]').scrollTop).toBe(0);
  });
});

describe('mobile drawer', () => {
  // The tool's drawer had no coverage at all, while the site's identical-pattern
  // drawer was tested — and a failure here loses the entire sidebar on mobile,
  // because the sidebar is a single node that MOVES rather than being duplicated.
  const drawer = () => $<HTMLDialogElement>('dialog[data-menu]');
  const sidebar = () => $('[data-sidebar]');

  it('moves the one sidebar node into the drawer on open', () => {
    start();
    expect(sidebar().parentElement).toBe($('[data-sidebar-home]'));

    $<HTMLButtonElement>('[data-menu-open]').click();

    expect(drawer().open).toBe(true);
    expect(sidebar().parentElement).toBe($('[data-drawer-slot]'));
    // Exactly one sidebar exists at any moment; a copy would desync its state.
    expect(document.querySelectorAll('[data-sidebar]')).toHaveLength(1);
  });

  it('puts it back home when the drawer closes', () => {
    start();
    $<HTMLButtonElement>('[data-menu-open]').click();
    $<HTMLButtonElement>('[data-menu-close]').click();

    expect(drawer().open).toBe(false);
    expect(sidebar().parentElement).toBe($('[data-sidebar-home]'));
  });

  it('puts it back when the drawer is closed by the backdrop', () => {
    start();
    $<HTMLButtonElement>('[data-menu-open]').click();
    // A click whose target is the dialog itself is the backdrop; a native dialog
    // does not close on it, which is why the runtime wires this.
    drawer().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(sidebar().parentElement).toBe($('[data-sidebar-home]'));
  });

  it('leaves the drawer open when the click is inside it', () => {
    start();
    $<HTMLButtonElement>('[data-menu-open]').click();
    $('[data-drawer-slot]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(drawer().open).toBe(true);
    expect(sidebar().parentElement).toBe($('[data-drawer-slot]'));
  });

  it('closes the drawer when the viewport crosses to desktop', () => {
    // Otherwise the sidebar stays trapped in a hidden dialog at a width where the
    // aside is visible and expected to hold it.
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    window.matchMedia = (() => ({
      matches: mdMatches,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
    })) as unknown as typeof window.matchMedia;
    start();
    $<HTMLButtonElement>('[data-menu-open]').click();
    expect(drawer().open).toBe(true);

    for (const fn of listeners) fn({ matches: true });

    expect(drawer().open).toBe(false);
    expect(sidebar().parentElement).toBe($('[data-sidebar-home]'));
  });
});

describe('dragging a tile, through the whole runtime', () => {
  // startSeparatorDrag has its own unit tests, but nothing exercised it THROUGH
  // initTool's delegate — so nothing checked that the runtime hands it the current
  // color and the current label. That hand-off is the product: with a label the
  // drag must stay fully native so the browser names the bookmark from the
  // anchor's link text, and any setData() call would replace and lose that name.
  function dragTile(icon: string): { setData: ReturnType<typeof vi.fn> } {
    const setData = vi.fn();
    const e = new Event('dragstart', { bubbles: true });
    Object.defineProperty(e, 'dataTransfer', { value: { setData } });
    tile(icon).dispatchEvent(e);
    return { setData };
  }

  it('with no label: hands the drag the selected color and parks on that bookmark', () => {
    writeString(STORAGE_KEYS.color, ROSE);
    start();

    const { setData } = dragTile('pipe');

    expect(setData).toHaveBeenCalledWith('text/plain', '');
    expect(setData).toHaveBeenCalledWith(
      'text/uri-list',
      window.location.origin + bookmarkUrl('pipe', ROSE)
    );
    // The page parks on the dropped bookmark's own URL, and its favicon freezes
    // there, which is the entire favicon guarantee.
    expect(pageUrl()).toBe(bookmarkUrl('pipe', ROSE));
    expect(faviconHref()).toBe(faviconDataUri('pipe', ROSE));
  });

  it('follows the color the visitor just picked, not the stored one', () => {
    writeString(STORAGE_KEYS.color, TEAL);
    start();
    $<HTMLElement>(`button[data-swatch][data-hex="${ROSE}"]`).click();

    const { setData } = dragTile('dot');

    expect(setData).toHaveBeenCalledWith(
      'text/uri-list',
      window.location.origin + bookmarkUrl('dot', ROSE)
    );
  });

  it('with a label: sets no data at all, so the browser keeps the link text', () => {
    start();
    // The label section shares this fixture's [data-tile] [data-label] spans.
    const input = $<HTMLInputElement>('input[data-label-input]');
    input.value = 'Work';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const { setData } = dragTile('pipe');

    expect(setData).not.toHaveBeenCalled();
    // The decorated label is in the DOM before the drag starts, on every tile.
    expect(tile('pipe').querySelector('[data-label]')!.textContent).toBe('Work');
    // The favicon still freezes for the dropped bookmark.
    expect(pageUrl()).toBe(bookmarkUrl('pipe', DEFAULT_COLOR_HEX));
  });
});
