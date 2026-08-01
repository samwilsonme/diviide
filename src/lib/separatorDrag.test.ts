// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSeparatorDrag } from './separatorDrag';
import { bookmarkUrl } from './bookmarkUrl';
import { faviconDataUri } from './favicon';

// The executable spec for the one drag contract every drag source shares.
// jsdom fires no native drags, so the suite calls startSeparatorDrag directly
// with a stubbed dataTransfer ({ setData } only — no setDragImage, so the drag
// ghost path no-ops; that path is covered by dragImage.test.ts).

const TEAL = '#0d9488';

function makeEvent(): { e: DragEvent; setData: ReturnType<typeof vi.fn> } {
  const setData = vi.fn();
  const e = new Event('dragstart', { bubbles: true });
  Object.defineProperty(e, 'dataTransfer', { value: { setData } });
  return { e: e as unknown as DragEvent, setData };
}

const faviconHref = () =>
  (document.getElementById('diviide-favicon') as HTMLLinkElement | null)?.href ?? null;
const pageUrl = () => location.pathname + location.search;

beforeEach(() => {
  // Reset per-page-session favicon state (see main.dom.test.ts).
  window.__diviideParkedFrom = null;
  window.__diviideIconTemplates = {
    pipe: '<svg><path stroke="black" d="M12 4v16"/></svg>',
  };
  document.getElementById('diviide-favicon')?.remove();
  history.replaceState({}, '', '/separators/');
  document.body.innerHTML = '<a data-tile data-icon="pipe" href="#"></a>';
});

describe('startSeparatorDrag', () => {
  const tile = () => document.querySelector('a[data-tile]')!;

  it('with no label: blanks text/plain and sets text/uri-list to the bookmark URL', () => {
    const { e, setData } = makeEvent();
    startSeparatorDrag(e, tile(), 'pipe', TEAL);

    // text/plain is blanked so the URL never becomes the bookmark title.
    expect(setData).toHaveBeenCalledWith('text/plain', '');
    expect(setData).toHaveBeenCalledWith(
      'text/uri-list',
      window.location.origin + bookmarkUrl('pipe', TEAL)
    );
    expect(setData).toHaveBeenCalledTimes(2);
  });

  it('with a label: never calls setData, so the native link text names the bookmark', () => {
    const { e, setData } = makeEvent();
    startSeparatorDrag(e, tile(), 'pipe', TEAL, '--- Work ---');

    // Any setData() call would replace the anchor's hidden link text and lose
    // the bookmark name — the drag must stay fully native.
    expect(setData).not.toHaveBeenCalled();
  });

  it('parks the page on the bookmark URL and freezes the matching favicon', () => {
    const { e } = makeEvent();
    startSeparatorDrag(e, tile(), 'pipe', TEAL);

    expect(pageUrl()).toBe(bookmarkUrl('pipe', TEAL));
    expect(faviconHref()).toBe(faviconDataUri('pipe', TEAL));
  });
});
