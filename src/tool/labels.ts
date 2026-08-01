// The label section's entire runtime: the text input, the Advanced decoration
// controls (presets, fill incl. a custom glyph, alignment, end-caps with
// mirrored suggestions, length), the live preview + fit meter, copy, and
// reset. Extracted from main.ts (like colorPicker.ts) so the wiring is
// self-contained and testable.
//
// initLabels() returns dragLabel(): the decorated label the browser should name
// a dropped bookmark with (empty when the input is blank). main.ts feeds it
// into the dragstart contract. The decorated text also lives in every tile's
// hidden [data-label] span (applyLabels) so a native drag picks it up; the
// visible preview mirrors it in the OS UI font.

import {
  formatLabel,
  labelFitLevel,
  clampLength,
  MEASURE_FONT,
  FIT_DESCRIPTIONS,
  DEFAULT_LABEL_OPTIONS,
  ALIGN_OPTIONS,
  FILL_OPTIONS,
  LABEL_PRESETS,
  MIRROR_CAP,
  LENGTH_DEFAULT,
  type LabelAlign,
  type LabelFormatOptions,
} from '../lib/labelFormat';
import { STORAGE_KEYS, readString, writeString, readJSON, writeJSON } from '../lib/storage';
import { $, $$ } from '../lib/dom';
import { flashLabel } from '../lib/flashLabel';

// Sentinel <option> value for a user-typed fill glyph not in the preset list.
const FILL_OTHER = '__other__';
const FILL_VALUES = new Set(FILL_OPTIONS.map(([value]) => value));
// Derived from the same option list the <select> renders, like FILL_VALUES above,
// so adding an alignment upstream can't leave this validator silently rejecting it.
const ALIGNS: readonly LabelAlign[] = ALIGN_OPTIONS.map(([value]) => value);
// Fit-meter color per severity tier (base classes live in the markup).
const FIT_CLASS = {
  fits: 'text-muted-foreground/80',
  bar: 'text-warning',
  folder: 'text-destructive',
} as const;

// First code point of a typed fill, ignoring whitespace (which Chrome collapses
// out of bookmark titles anyway). Returns '' when there is nothing usable.
function firstGlyph(value: string): string {
  const chars = [...value.trim()];
  return chars.length > 0 ? chars[0] : '';
}

// Merge the stored options over the defaults with light validation, so a
// corrupted or partial blob can never produce an invalid state.
function readLabelOptions(): LabelFormatOptions {
  // Corrupted storage can hold any JSON shape (null, a number, a string);
  // anything but a real object falls back to an empty blob.
  const stored = readJSON<Partial<LabelFormatOptions> | null>(STORAGE_KEYS.labelOptions, {});
  const raw = typeof stored === 'object' && stored !== null ? stored : {};
  const lengthNum = typeof raw.length === 'number' ? raw.length : LENGTH_DEFAULT;
  return {
    align: ALIGNS.includes(raw.align as LabelAlign)
      ? (raw.align as LabelAlign)
      : DEFAULT_LABEL_OPTIONS.align,
    fill: typeof raw.fill === 'string' ? raw.fill : DEFAULT_LABEL_OPTIONS.fill,
    prepend: typeof raw.prepend === 'string' ? raw.prepend : '',
    append: typeof raw.append === 'string' ? raw.append : '',
    length: clampLength(lengthNum),
  };
}

export function initLabels(signal?: AbortSignal): { dragLabel: () => string } {
  let labelText = readString(STORAGE_KEYS.labelText, '');
  const options = readLabelOptions();

  // formatLabel returns '' for blank text, so a blank input drags icon-only.
  const dragLabel = () => formatLabel(labelText, options);

  const input = $<HTMLInputElement>('input[data-label-input]');
  const clearBtn = $<HTMLButtonElement>('button[data-label-clear]');
  const advanced = $<HTMLDetailsElement>('[data-label-advanced]');
  const fillSel = $<HTMLSelectElement>('select[data-label-fill]');
  const fillCustom = $<HTMLInputElement>('input[data-label-fill-custom]');
  const alignSel = $<HTMLSelectElement>('select[data-label-align]');
  const prependSel = $<HTMLSelectElement>('select[data-label-prepend]');
  const appendSel = $<HTMLSelectElement>('select[data-label-append]');
  const lengthInput = $<HTMLInputElement>('input[data-label-length]');
  const lengthValue = $('[data-label-length-value]');
  const preview = $('[data-label-preview]');
  const previewEmpty = $('[data-label-preview-empty]');
  const fit = $('[data-label-fit]');
  const copyBtn = $<HTMLButtonElement>('button[data-label-copy]');
  const resetBtn = $<HTMLButtonElement>('button[data-label-reset]');

  // Measures label width in the OS UI font (system-ui) — the same typeface Chrome
  // renders bookmark titles in — so the fit meter reflects the user's real font.
  // Resolved once on first use: the context if 2D canvas is available, else null
  // (measurement unsupported), so we never retry a failed getContext per call.
  let measureCtx: CanvasRenderingContext2D | null | undefined;
  function measureLabelPx(text: string): number {
    if (measureCtx === undefined) {
      measureCtx = document.createElement('canvas').getContext('2d');
      if (measureCtx) measureCtx.font = MEASURE_FONT;
    }
    return measureCtx ? Math.round(measureCtx.measureText(text).width) : 0;
  }

  const persist = () => writeJSON(STORAGE_KEYS.labelOptions, options);

  // With a label, the drag stays fully native and the browser names the bookmark
  // after the anchor's hidden link text — so the text must be in the DOM before
  // the drag starts, on every drag source.
  function applyLabels(text: string): void {
    for (const span of $$('[data-tile] [data-label]')) span.textContent = text;
  }

  function updatePreview(decorated: string): void {
    if (preview) preview.textContent = decorated;
    if (previewEmpty) previewEmpty.hidden = decorated !== '';
    if (copyBtn) copyBtn.hidden = decorated === '' || !navigator.clipboard;
    if (fit) {
      // Always show the approximate width; append a truncation warning only when
      // there is one, colored by severity. px === 0 means the label is empty or
      // canvas measurement is unavailable, so hide the meter entirely then.
      const px = decorated === '' ? 0 : measureLabelPx(decorated);
      fit.hidden = px === 0;
      if (px > 0) {
        const level = labelFitLevel(px);
        const verdict = FIT_DESCRIPTIONS[level];
        fit.textContent = verdict ? `≈ ${px}px · ${verdict}` : `≈ ${px}px`;
        fit.classList.remove(...Object.values(FIT_CLASS));
        fit.classList.add(FIT_CLASS[level]);
      }
    }
  }

  // Decorate once per change, then fan the result out to the drag spans and
  // the preview (formatLabel is cheap, but there is no reason to run it four
  // times per keystroke).
  const refresh = () => {
    const decorated = dragLabel();
    applyLabels(decorated);
    updatePreview(decorated);
  };

  // Advanced only decorates existing text, so it stays visible but disabled
  // (dimmed, uninteractive, snapped shut) until the input has some.
  function syncAdvancedEnabled(): void {
    if (!advanced) return;
    const disabled = labelText.trim() === '';
    advanced.toggleAttribute('data-disabled', disabled);
    advanced.setAttribute('aria-disabled', String(disabled));
    if (disabled) advanced.open = false;
  }

  // Fill = none makes alignment and length inert — disable and dim them.
  function updateInertControls(): void {
    const inert = options.fill === 'none';
    for (const el of [alignSel, lengthInput]) {
      if (!el) continue;
      el.disabled = inert;
      el.closest('label')?.classList.toggle('opacity-50', inert);
    }
  }

  // Push the current options onto every control (after a preset, reset, or load).
  function seedControls(): void {
    if (input) input.value = labelText;
    if (clearBtn) clearBtn.hidden = labelText === '';
    syncAdvancedEnabled();
    if (fillSel) {
      const known = FILL_VALUES.has(options.fill);
      fillSel.value = known ? options.fill : FILL_OTHER;
      if (fillCustom) {
        fillCustom.hidden = known;
        if (!known) fillCustom.value = options.fill;
      }
    }
    if (alignSel) alignSel.value = options.align;
    if (prependSel) prependSel.value = options.prepend;
    if (appendSel) appendSel.value = options.append;
    if (lengthInput) lengthInput.value = String(options.length);
    if (lengthValue) lengthValue.textContent = String(options.length);
    updateInertControls();
  }

  // ---- listeners ------------------------------------------------------------
  input?.addEventListener(
    'input',
    () => {
      labelText = input.value;
      writeString(STORAGE_KEYS.labelText, labelText);
      if (clearBtn) clearBtn.hidden = labelText === '';
      syncAdvancedEnabled();
      refresh();
    },
    { signal }
  );

  clearBtn?.addEventListener(
    'click',
    () => {
      labelText = '';
      writeString(STORAGE_KEYS.labelText, labelText);
      if (input) {
        input.value = '';
        input.focus();
      }
      clearBtn.hidden = true;
      syncAdvancedEnabled();
      refresh();
    },
    { signal }
  );

  // pointer-events-none blocks the mouse, but the summary can still be reached
  // with the keyboard; snap shut if it opens while disabled.
  advanced?.addEventListener(
    'toggle',
    () => {
      if (advanced.hasAttribute('data-disabled') && advanced.open) {
        advanced.open = false;
      }
    },
    { signal }
  );

  fillSel?.addEventListener(
    'change',
    () => {
      if (fillSel.value === FILL_OTHER) {
        if (fillCustom) {
          fillCustom.hidden = false;
          fillCustom.focus();
          options.fill = firstGlyph(fillCustom.value) || 'none';
        }
      } else {
        if (fillCustom) fillCustom.hidden = true;
        options.fill = fillSel.value;
      }
      persist();
      updateInertControls();
      refresh();
    },
    { signal }
  );

  fillCustom?.addEventListener(
    'input',
    () => {
      options.fill = firstGlyph(fillCustom.value) || 'none';
      persist();
      updateInertControls();
      refresh();
    },
    { signal }
  );

  alignSel?.addEventListener(
    'change',
    () => {
      options.align = alignSel.value as LabelAlign;
      persist();
      refresh();
    },
    { signal }
  );

  // Whether the current append is the module's own mirrored suggestion (as
  // opposed to a choice the user made in the append select). A suggestion may
  // be replaced or cleared by a later prepend change; an explicit choice never
  // is. Presets/reset count as explicit — they set both caps deliberately.
  let appendAuto = false;

  prependSel?.addEventListener(
    'change',
    () => {
      options.prepend = prependSel.value;
      // Suggest the mirrored closing cap, but never override an explicit choice.
      if (!options.append || appendAuto) {
        options.append = options.prepend ? (MIRROR_CAP[options.prepend] ?? '') : '';
        appendAuto = options.append !== '';
        if (appendSel) appendSel.value = options.append;
      }
      persist();
      refresh();
    },
    { signal }
  );

  appendSel?.addEventListener(
    'change',
    () => {
      options.append = appendSel.value;
      appendAuto = false;
      persist();
      refresh();
    },
    { signal }
  );

  lengthInput?.addEventListener(
    'input',
    () => {
      const typed = parseInt(lengthInput.value, 10);
      options.length = clampLength(Number.isFinite(typed) ? typed : LENGTH_DEFAULT);
      if (lengthValue) lengthValue.textContent = String(options.length);
      persist();
      refresh();
    },
    { signal }
  );

  for (const btn of $$('button[data-label-preset]')) {
    btn.addEventListener(
      'click',
      () => {
        const preset = LABEL_PRESETS[Number(btn.dataset.labelPreset)];
        if (!preset) return;
        Object.assign(options, preset.options);
        appendAuto = false;
        persist();
        seedControls();
        refresh();
      },
      { signal }
    );
  }

  resetBtn?.addEventListener(
    'click',
    () => {
      Object.assign(options, DEFAULT_LABEL_OPTIONS);
      appendAuto = false;
      persist();
      seedControls();
      refresh();
    },
    { signal }
  );

  // Verdict flashing (including the capture-the-caption-at-wire-up rule) lives in
  // lib/flashLabel, shared with the consuming site's share button.
  const copyLabel = copyBtn ? (copyBtn.querySelector('[data-label-copy-text]') ?? copyBtn) : null;
  const copyFlash = copyLabel ? flashLabel(copyLabel, 1200, signal) : null;

  copyBtn?.addEventListener(
    'click',
    () => {
      const decorated = dragLabel();
      if (!decorated || !navigator.clipboard) return;
      // writeText rejects when the document loses focus or the permission is
      // denied; surface that instead of leaving an unhandled rejection and a
      // button that silently does nothing.
      navigator.clipboard.writeText(decorated).then(
        () => copyFlash?.flash('Copied'),
        () => copyFlash?.flash('Copy failed')
      );
    },
    { signal }
  );

  // Position the "what is a label?" popover under its trigger (popovers open in
  // the top layer with no anchor by default).
  const infoBtn = $('button[data-label-info-btn]');
  const popover = $('[data-label-popover]');
  let popoverOpen = false;
  popover?.addEventListener(
    'toggle',
    (e) => {
      popoverOpen = (e as ToggleEvent).newState === 'open';
      if (!popoverOpen || !infoBtn) return;
      const r = infoBtn.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      popover.style.width = `${width}px`;
      popover.style.left = `${Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))}px`;
      // Below the trigger by default; flip above when the bottom edge would
      // leave the viewport (only the horizontal axis was clamped before).
      popover.style.top = `${r.bottom + 8}px`;
      const overflow = popover.getBoundingClientRect().bottom - (window.innerHeight - 8);
      if (overflow > 0) popover.style.top = `${Math.max(8, r.top - 8 - popover.offsetHeight)}px`;
    },
    { signal }
  );
  // The popover is position:fixed and placed once at open, so any scroll (the
  // sidebar is its own scroll pane — capture sees it) or resize would leave it
  // floating detached from its trigger: close it instead of tracking it.
  const closeDetachedPopover = (): void => {
    if (popoverOpen && popover && typeof popover.hidePopover === 'function') popover.hidePopover();
  };
  document.addEventListener('scroll', closeDetachedPopover, {
    capture: true,
    passive: true,
    signal,
  });
  window.addEventListener('resize', closeDetachedPopover, { signal });

  seedControls();
  refresh();

  return { dragLabel };
}
