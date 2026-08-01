/**
 * Use a clean, static snapshot of the dragged tile as the drag ghost.
 *
 * A live separator tile can be mid-animation (e.g. the guide pages' `separator-bob`
 * transform), and the browser's default drag ghost captures that mid-animation
 * frame — which loses the tile's rounded-corner clipping and renders a filled
 * square. Snapshotting a throwaway off-screen clone with the animation/transform
 * frozen restores the tile exactly as it looks on the page: rounded corners,
 * fill, and border, with transparent corners. Cosmetic only — does not affect
 * the dropped bookmark (driven by dataTransfer + selectFavicon).
 */
export function setIconDragImage(e: DragEvent, tile: Element): void {
  if (!(tile instanceof HTMLElement)) return;
  // jsdom (and any non-DnD environment) has no setDragImage; nothing to do there.
  if (typeof e.dataTransfer?.setDragImage !== 'function') return;

  const { width, height } = tile.getBoundingClientRect();
  const clone = tile.cloneNode(true) as HTMLElement;

  // Freeze the bob so the snapshot is a clean, upright tile rather than a mid-transform frame.
  clone.style.margin = '0';
  clone.style.animation = 'none';
  clone.style.transform = 'none';
  // Show the live selection color at full strength on the ghost, matching each tile's
  // hover state: a faded `ring-accent-live/40` becomes solid, and the neutral
  // tile borders pick up the accent. Each only affects the tile that has it.
  clone.style.setProperty('--tw-ring-color', 'var(--accent-live)');
  clone.style.borderColor = 'var(--accent-live)';
  // Grid tiles are `w-full`; pin the rendered size so the detached clone keeps its shape.
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  // Park off-screen so the clone never flashes on the page before its bitmap is captured.
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';

  document.body.appendChild(clone);
  e.dataTransfer.setDragImage(clone, width / 2, height / 2);

  // The browser captures the clone's bitmap during this tick; drop the node next tick.
  setTimeout(() => clone.remove(), 0);
}
