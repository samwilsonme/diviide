import { selectFavicon } from './favicon';
import { bookmarkUrl } from './bookmarkUrl';
import { setIconDragImage } from './dragImage';

/**
 * The one "drag a separator onto the bookmarks bar" contract, shared by every
 * drag source (the icon grid and the private site's separators) so they can
 * never drift apart:
 *
 * - The tile is snapshotted as a clean, static drag ghost (keeps its rounded
 *   corners; see setIconDragImage).
 * - With a `dragLabel`, the drag stays fully native: the browser names the
 *   bookmark after the anchor's hidden link text, and any setData() call would
 *   replace and lose it.
 * - Without one, `text/plain` is blanked (so the URL never becomes the bookmark
 *   title) and `text/uri-list` is set to the icon's own bookmark URL.
 * - `selectFavicon` then parks the page on that URL and sets the matching
 *   favicon, so the browser freezes the dropped bookmark's icon.
 *
 * `tile` is the dragged anchor element (event delegation means e.currentTarget
 * is the container, so the tile is passed explicitly).
 */
export function startSeparatorDrag(
  e: DragEvent,
  tile: Element,
  iconName: string,
  color: string,
  dragLabel = ''
): void {
  setIconDragImage(e, tile);

  if (!dragLabel && e.dataTransfer) {
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.setData('text/uri-list', window.location.origin + bookmarkUrl(iconName, color));
  }

  selectFavicon(iconName, color);
}
