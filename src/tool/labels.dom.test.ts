// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { initLabels } from './labels';
import {
  FILL_OPTIONS,
  ALIGN_OPTIONS,
  PREPEND_OPTIONS,
  APPEND_OPTIONS,
  LABEL_PRESETS,
} from '../lib/labelFormat';

// A fixture mirroring the data-* contract LabelSection.astro renders. Canvas is
// absent in jsdom, so the fit-meter px path is not exercised here (it is covered
// by the pure labelFitLevel/describeLabelFit unit tests); everything else is.
function mount(): void {
  const opts = (list: ReadonlyArray<readonly [string, string]>) =>
    list.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const caps = (list: readonly string[]) =>
    list.map((c) => `<option value="${c}">${c}</option>`).join('');
  document.body.innerHTML = `
    <a data-tile href="#"><span data-label></span></a>
    <a data-tile href="#"><span data-label></span></a>
    <div>
      <input data-label-input />
      <button type="button" data-label-clear hidden></button>
    </div>
    <div data-label-advanced>
      ${LABEL_PRESETS.map((p, i) => `<button type="button" data-label-preset="${i}">${p.name}</button>`).join('')}
      <button type="button" data-label-reset>Reset</button>
      <select data-label-fill>${opts(FILL_OPTIONS)}<option value="__other__">Custom…</option></select>
      <input data-label-fill-custom hidden />
      <label><select data-label-align>${opts(ALIGN_OPTIONS)}</select></label>
      <select data-label-prepend>${caps(PREPEND_OPTIONS)}</select>
      <select data-label-append>${caps(APPEND_OPTIONS)}</select>
      <label><input type="range" data-label-length min="10" max="60" value="20" /></label>
      <span data-label-length-value></span>
      <span data-label-preview></span>
      <span data-label-preview-empty></span>
      <span data-label-fit></span>
      <button type="button" data-label-copy hidden><span data-label-copy-text>Copy</span></button>
    </div>`;
}

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

function setText(text: string): void {
  const input = $<HTMLInputElement>('[data-label-input]');
  input.value = text;
  fire(input, 'input');
}

const tileText = () => $('[data-tile] [data-label]').textContent;
const storedOptions = () => JSON.parse(localStorage.getItem('diviide-label-options') || '{}');

beforeEach(() => {
  // jsdom has no canvas; measureLabelPx falls back to 0 (meter hidden). Stub it
  // to return null quietly instead of jsdom's "Not implemented" console noise.
  HTMLCanvasElement.prototype.getContext = () => null;
  localStorage.clear();
  mount();
  initLabels();
});

describe('initLabels', () => {
  it('writes plain text to every tile as the user types', () => {
    setText('Work');
    expect(tileText()).toBe('Work');
    expect($('[data-label-preview]').textContent).toBe('Work');
    expect(document.querySelectorAll('[data-tile] [data-label]')[1].textContent).toBe('Work');
  });

  it('clears every tile label when the input goes blank (icon-only drag)', () => {
    setText('Work');
    expect(tileText()).toBe('Work');
    setText('');
    expect(tileText()).toBe('');
    expect(document.querySelectorAll('[data-tile] [data-label]')[1].textContent).toBe('');
  });

  it('disables Advanced until the input has text, and closes it when text goes', () => {
    const advanced = $<HTMLElement>('[data-label-advanced]');
    setText('');
    expect(advanced.hasAttribute('data-disabled')).toBe(true);
    expect(advanced.getAttribute('aria-disabled')).toBe('true');
    setText('Work');
    expect(advanced.hasAttribute('data-disabled')).toBe(false);
    expect(advanced.getAttribute('aria-disabled')).toBe('false');
    setText('');
    expect(advanced.hasAttribute('data-disabled')).toBe(true);
  });

  it('the clear button shows only with text, and clears the input, tiles, and storage', () => {
    const clear = $<HTMLButtonElement>('[data-label-clear]');
    expect(clear.hidden).toBe(true);
    setText('Work');
    expect(clear.hidden).toBe(false);
    clear.click();
    expect($<HTMLInputElement>('[data-label-input]').value).toBe('');
    expect(tileText()).toBe('');
    expect(localStorage.getItem('diviide-label-text')).toBe('');
    expect(clear.hidden).toBe(true);
  });

  it('seeds the input, tiles, and clear button from a stored label', () => {
    localStorage.setItem('diviide-label-text', 'Work');
    mount();
    initLabels();
    expect($<HTMLInputElement>('[data-label-input]').value).toBe('Work');
    expect($<HTMLButtonElement>('[data-label-clear]').hidden).toBe(false);
    expect(tileText()).toBe('Work');
  });

  it('applies a preset to the controls and the tiles, and persists it', () => {
    setText('Work');
    const dashes = LABEL_PRESETS.findIndex((p) => p.name === 'Dashes');
    $(`[data-label-preset="${dashes}"]`).click();
    expect(tileText()).toBe('<------ Work ------>');
    expect($<HTMLSelectElement>('[data-label-fill]').value).toBe('-');
    expect($<HTMLSelectElement>('[data-label-prepend]').value).toBe('<');
    expect($<HTMLSelectElement>('[data-label-append]').value).toBe('>');
    expect(storedOptions().fill).toBe('-');
  });

  it('disables alignment and length when the fill is None', () => {
    setText('Work');
    const fill = $<HTMLSelectElement>('[data-label-fill]');
    fill.value = '-';
    fire(fill, 'change');
    expect($<HTMLInputElement>('[data-label-align]').disabled).toBe(false);
    fill.value = 'none';
    fire(fill, 'change');
    expect($<HTMLSelectElement>('[data-label-align]').disabled).toBe(true);
    expect($<HTMLInputElement>('[data-label-length]').disabled).toBe(true);
  });

  it('mirrors an opening cap to the matching closing cap (only when append is empty)', () => {
    setText('Work');
    const prepend = $<HTMLSelectElement>('[data-label-prepend]');
    prepend.value = '<';
    fire(prepend, 'change');
    expect($<HTMLSelectElement>('[data-label-append]').value).toBe('>');
    expect(storedOptions().append).toBe('>');
  });

  it('re-mirrors a later opening cap while the append is still its own suggestion', () => {
    setText('Work');
    const prepend = $<HTMLSelectElement>('[data-label-prepend]');
    const append = $<HTMLSelectElement>('[data-label-append]');
    prepend.value = '<';
    fire(prepend, 'change');
    expect(append.value).toBe('>');
    // Changing the opening cap replaces the suggestion instead of leaving a
    // mismatched pair; clearing it clears the suggestion too.
    prepend.value = '(';
    fire(prepend, 'change');
    expect(append.value).toBe(')');
    expect(storedOptions().append).toBe(')');
    prepend.value = '';
    fire(prepend, 'change');
    expect(append.value).toBe('');
  });

  it('never overrides an explicitly chosen closing cap', () => {
    setText('Work');
    const prepend = $<HTMLSelectElement>('[data-label-prepend]');
    const append = $<HTMLSelectElement>('[data-label-append]');
    append.value = ']';
    fire(append, 'change');
    prepend.value = '<';
    fire(prepend, 'change');
    expect(append.value).toBe(']');
    expect(storedOptions().append).toBe(']');
  });

  it('accepts a custom fill glyph via the Custom option', () => {
    setText('Work');
    const fill = $<HTMLSelectElement>('[data-label-fill]');
    fill.value = '__other__';
    fire(fill, 'change');
    const custom = $<HTMLInputElement>('[data-label-fill-custom]');
    expect(custom.hidden).toBe(false);
    custom.value = '+';
    fire(custom, 'input');
    expect(tileText()).toBe('+++++++ Work +++++++');
    expect(storedOptions().fill).toBe('+');
  });

  it('falls back to the default options when the stored blob is not an object', () => {
    // Valid JSON, wrong shape: must not crash init, just use the defaults.
    localStorage.setItem('diviide-label-options', 'null');
    mount();
    initLabels();
    setText('Work');
    expect(tileText()).toBe('Work');
    expect($<HTMLSelectElement>('[data-label-fill]').value).toBe('none');
  });

  it('reset restores the defaults', () => {
    setText('Work');
    const dashes = LABEL_PRESETS.findIndex((p) => p.name === 'Dashes');
    $(`[data-label-preset="${dashes}"]`).click();
    $('[data-label-reset]').click();
    expect(tileText()).toBe('Work');
    expect($<HTMLSelectElement>('[data-label-fill]').value).toBe('none');
    expect(storedOptions().fill).toBe('none');
  });

  it('copies the decorated label to the clipboard and flashes Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // The copy button only shows when navigator.clipboard exists, so define it
    // before re-init. jsdom leaves it undefined by default.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      mount();
      initLabels();
      const dashes = LABEL_PRESETS.findIndex((p) => p.name === 'Dashes');
      setText('Work');
      $(`[data-label-preset="${dashes}"]`).click();

      const copy = $<HTMLButtonElement>('[data-label-copy]');
      expect(copy.hidden).toBe(false);
      copy.click();
      // waitFor, not a one-tick setTimeout: the flash lands at the end of a promise
      // chain, so a fixed tick only works while that chain stays exactly one deep.
      await vi.waitFor(() => expect($('[data-label-copy-text]').textContent).toBe('Copied'));
      expect(writeText).toHaveBeenCalledWith('<------ Work ------>');
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('flashes Copy failed when the clipboard write is rejected', async () => {
    // writeText rejects when the document loses focus or permission is denied;
    // the button must say so instead of silently doing nothing.
    const writeText = vi.fn().mockRejectedValue(new Error('document not focused'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      mount();
      initLabels();
      setText('Work');
      const copy = $<HTMLButtonElement>('[data-label-copy]');
      copy.click();
      await vi.waitFor(() => expect($('[data-label-copy-text]').textContent).toBe('Copy failed'));
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('restores the Copy caption after the flash, even across rapid clicks', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      mount();
      initLabels();
      setText('Work');
      const copy = $<HTMLButtonElement>('[data-label-copy]');
      copy.click();
      await vi.advanceTimersByTimeAsync(0);
      expect($('[data-label-copy-text]').textContent).toBe('Copied');
      // A second click mid-flash must not capture 'Copied' as the caption to
      // restore (the regression that stuck the button on 'Copied' forever).
      copy.click();
      await vi.advanceTimersByTimeAsync(1200);
      expect($('[data-label-copy-text]').textContent).toBe('Copy');
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
      vi.useRealTimers();
    }
  });
});
