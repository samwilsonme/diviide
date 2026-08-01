// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setIconDragImage } from './dragImage';

// jsdom fires no native drags and its DataTransfer has no setDragImage, so this
// suite drives setIconDragImage directly with a stubbed dataTransfer to pin the
// clone lifecycle: the frozen animation/transform, the pinned size, the centered
// grab point, and the deferred removal (a leak would add one off-screen node
// per drag).

function makeTile(): HTMLElement {
  const tile = document.createElement('a');
  tile.getBoundingClientRect = () => ({ width: 64, height: 64 }) as DOMRect;
  document.body.appendChild(tile);
  return tile;
}

function makeEvent(): { e: DragEvent; setDragImage: ReturnType<typeof vi.fn> } {
  const setDragImage = vi.fn();
  return { e: { dataTransfer: { setDragImage } } as unknown as DragEvent, setDragImage };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('setIconDragImage', () => {
  it('does nothing in an environment without setDragImage', () => {
    const tile = makeTile();
    setIconDragImage({ dataTransfer: {} } as unknown as DragEvent, tile);
    // No clone was appended next to the tile.
    expect(document.body.children).toHaveLength(1);
  });

  it('snapshots a frozen, pinned-size clone grabbed at its center', () => {
    const tile = makeTile();
    const { e, setDragImage } = makeEvent();
    setIconDragImage(e, tile);

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const [clone, x, y] = setDragImage.mock.calls[0] as [HTMLElement, number, number];
    expect(clone).not.toBe(tile);
    // The bob animation/transform is frozen so the snapshot is a clean tile.
    expect(clone.style.animation).toBe('none');
    expect(clone.style.transform).toBe('none');
    // The rendered size is pinned so the detached clone keeps its shape.
    expect(clone.style.width).toBe('64px');
    expect(clone.style.height).toBe('64px');
    // Grabbed at the center of the 64x64 tile.
    expect(x).toBe(32);
    expect(y).toBe(32);
    // The clone must be in the document for the browser to capture its bitmap.
    expect(clone.parentElement).toBe(document.body);
  });

  it('removes the throwaway clone on the next tick', () => {
    vi.useFakeTimers();
    const tile = makeTile();
    const { e, setDragImage } = makeEvent();
    setIconDragImage(e, tile);

    const clone = setDragImage.mock.calls[0][0] as HTMLElement;
    expect(clone.isConnected).toBe(true);
    vi.runAllTimers();
    expect(clone.isConnected).toBe(false);
  });
});
