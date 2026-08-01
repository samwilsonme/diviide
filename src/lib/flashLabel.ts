// A button that briefly reports what happened ("Copied", "Copy failed") and then
// returns to its resting caption. Both repos had their own copy of this, each
// carrying the same warning comment about the trap below.

interface FlashLabel {
  /** Show `text`, then restore the resting caption after the delay. */
  flash: (text: string) => void;
}

/**
 * Wire a flashing caption on `el`.
 *
 * The resting caption is read once, here at wire-up — NOT inside the flash. That
 * is the whole point: reading it later means a second flash while the first is
 * still showing captures "Copied" as the text to restore, and the button stays
 * stuck on it forever. Rapid double-clicks are exactly when a user is most likely
 * to do this.
 *
 * `signal` cancels a pending restore, since a timer outlives the element it writes
 * to (AbortSignal does not cover setTimeout, so this is wired by hand).
 */
export function flashLabel(el: Element, restoreMs = 2000, signal?: AbortSignal): FlashLabel {
  const resting = el.textContent ?? '';
  let timer = 0;

  signal?.addEventListener('abort', () => window.clearTimeout(timer));

  return {
    flash(text: string): void {
      el.textContent = text;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.textContent = resting;
      }, restoreMs);
    },
  };
}
