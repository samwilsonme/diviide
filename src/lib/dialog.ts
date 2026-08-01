// The <dialog> wiring every modal in both repos needs, in one place. A native
// dialog closes on Escape by itself but not on a backdrop click, and each modal
// also has its own close button — so every one of them was repeating the same
// three lines plus the same comment explaining the backdrop part.

interface WireDialogOptions {
  /** Selector for the close button inside the dialog. */
  closeSelector?: string;
  /** Ties the listeners to a caller's lifetime (see initTool's AbortController). */
  signal?: AbortSignal;
  /** Runs after the dialog closes, however it was closed (button, backdrop, Escape). */
  onClose?: () => void;
}

/**
 * Wire a dialog's close paths. Escape is native and needs nothing.
 *
 * The backdrop check is `e.target === dialog`: a click anywhere inside the dialog
 * has that element as its target, so only a click on the dialog box itself — which
 * is what the ::backdrop area reports — closes it.
 */
export function wireDialog(dialog: HTMLDialogElement, options: WireDialogOptions = {}): void {
  const { closeSelector = '[data-dialog-close]', signal, onClose } = options;

  dialog.querySelector(closeSelector)?.addEventListener('click', () => dialog.close(), { signal });

  dialog.addEventListener(
    'click',
    (e) => {
      if (e.target === dialog) dialog.close();
    },
    { signal }
  );

  if (onClose) dialog.addEventListener('close', onClose, { signal });
}
