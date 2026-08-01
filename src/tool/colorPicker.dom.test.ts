// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initColorPicker } from './colorPicker';

// Minimal markup matching ColorPicker.astro's Advanced disclosure.
function mount(): void {
  const root = document.createElement('div');
  root.innerHTML = `
    <div data-sv role="slider" tabindex="0"><span data-sv-thumb></span></div>
    <div data-hue role="slider" tabindex="0"><span data-hue-thumb></span></div>
    <select data-color-format>
      <option value="hex">HEX</option>
      <option value="rgb">RGB</option>
      <option value="hsl">HSL</option>
    </select>
    <div data-format-fields="hex"><input data-color-hex /></div>
    <div data-format-fields="rgb" hidden>
      <input type="number" data-rgb-r /><input type="number" data-rgb-g /><input type="number" data-rgb-b />
    </div>
    <div data-format-fields="hsl" hidden>
      <input type="number" data-hsl-h /><input type="number" data-hsl-s /><input type="number" data-hsl-l />
    </div>
    <button type="button" data-eyedropper hidden></button>
  `;
  document.body.replaceChildren(root);
}

const els = () => ({
  format: document.querySelector<HTMLSelectElement>('select[data-color-format]')!,
  hexGroup: document.querySelector<HTMLElement>('[data-format-fields="hex"]')!,
  rgbGroup: document.querySelector<HTMLElement>('[data-format-fields="rgb"]')!,
  hslGroup: document.querySelector<HTMLElement>('[data-format-fields="hsl"]')!,
  hex: document.querySelector<HTMLInputElement>('input[data-color-hex]')!,
  r: document.querySelector<HTMLInputElement>('input[data-rgb-r]')!,
  g: document.querySelector<HTMLInputElement>('input[data-rgb-g]')!,
  b: document.querySelector<HTMLInputElement>('input[data-rgb-b]')!,
  h: document.querySelector<HTMLInputElement>('input[data-hsl-h]')!,
  s: document.querySelector<HTMLInputElement>('input[data-hsl-s]')!,
  l: document.querySelector<HTMLInputElement>('input[data-hsl-l]')!,
});

describe('initColorPicker', () => {
  beforeEach(() => mount());

  it('returns null when the markup is absent', () => {
    expect(initColorPicker(document.createElement('div'), () => {})).toBeNull();
  });

  it('setColor fills the hex + RGB fields without firing onChange', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    onChange.mockClear();

    picker.setColor('#3b82f6');
    const f = els();
    expect(f.hex.value).toBe('#3b82f6');
    expect([f.r.value, f.g.value, f.b.value]).toEqual(['59', '130', '246']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies a pasted rgb() value and emits the hex', () => {
    const onChange = vi.fn();
    initColorPicker(document, onChange)!;
    const f = els();

    f.hex.value = 'rgb(255, 0, 0)';
    f.hex.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    // RGB fields update, but the hex field keeps what the user typed until blur.
    expect([f.r.value, f.g.value, f.b.value]).toEqual(['255', '0', '0']);
    expect(f.hex.value).toBe('rgb(255, 0, 0)');
  });

  it('editing an R/G/B field emits the recombined hex', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#000000');
    onChange.mockClear();
    const f = els();

    f.r.value = '255';
    f.r.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    expect(f.hex.value).toBe('#ff0000');
  });

  it('switching format toggles which field group is shown', () => {
    initColorPicker(document, vi.fn())!;
    const f = els();
    expect(f.hexGroup.hidden).toBe(false);
    expect(f.rgbGroup.hidden).toBe(true);

    f.format.value = 'hsl';
    f.format.dispatchEvent(new Event('change', { bubbles: true }));
    expect(f.hexGroup.hidden).toBe(true);
    expect(f.hslGroup.hidden).toBe(false);
  });

  it('setColor fills the HSL fields too', () => {
    const picker = initColorPicker(document, vi.fn())!;
    picker.setColor('#ff0000'); // red -> hsl(0, 100%, 50%)
    const f = els();
    expect([f.h.value, f.s.value, f.l.value]).toEqual(['0', '100', '50']);
  });

  it('editing an H/S/L field emits the recombined hex', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#000000');
    onChange.mockClear();
    const f = els();

    f.h.value = '0';
    f.s.value = '100';
    f.l.value = '50';
    f.l.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
  });

  it('reflects the slider values in aria-valuenow and aria-valuetext', () => {
    const picker = initColorPicker(document, vi.fn())!;
    picker.setColor('#00ff00'); // green -> h=120, s=1, v=1
    const sv = document.querySelector<HTMLElement>('[data-sv]')!;
    const hue = document.querySelector<HTMLElement>('[data-hue]')!;
    expect(sv.getAttribute('aria-valuenow')).toBe('100');
    expect(sv.getAttribute('aria-valuetext')).toBe('#00ff00');
    expect(hue.getAttribute('aria-valuenow')).toBe('120');
    expect(hue.getAttribute('aria-valuetext')).toBe('hue 120');
  });

  it('restores an unparseable hex field on blur', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#22c55e');
    onChange.mockClear();
    const f = els();

    f.hex.value = 'nonsense';
    f.hex.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
    f.hex.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(f.hex.value).toBe('#22c55e');
  });

  const key = (sel: string, k: string) =>
    document
      .querySelector<HTMLElement>(sel)!
      .dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  it('nudges saturation/value with the arrow keys on the square', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#808080');
    onChange.mockClear();

    key('[data-sv]', 'ArrowRight'); // +saturation
    key('[data-sv]', 'ArrowUp'); // +value
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('nudges hue with the arrow keys on the bar and wraps past 0', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#ff0000'); // hue 0
    onChange.mockClear();
    const hue = document.querySelector<HTMLElement>('[data-hue]')!;

    key('[data-hue]', 'ArrowLeft'); // 0 - 4 wraps to 356
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hue.getAttribute('aria-valuenow')).toBe('356');
  });

  it('ignores non-arrow keys on the sliders', () => {
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#808080');
    onChange.mockClear();

    key('[data-sv]', 'Enter');
    key('[data-hue]', 'Tab');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('eyedropper', () => {
  const btn = () => document.querySelector<HTMLButtonElement>('button[data-eyedropper]')!;
  beforeEach(() => mount());
  afterEach(() => {
    delete window.EyeDropper;
  });

  it('stays hidden when the EyeDropper API is unavailable', () => {
    initColorPicker(document, vi.fn())!;
    expect(btn().hidden).toBe(true);
  });

  it('picks a color, fills the fields, and emits it', async () => {
    window.EyeDropper = class {
      open() {
        return Promise.resolve({ sRGBHex: '#3b82f6' });
      }
    };
    const onChange = vi.fn();
    initColorPicker(document, onChange)!;
    expect(btn().hidden).toBe(false);

    btn().click();
    // waitFor, not a one-tick setTimeout: the eyedropper resolves through a promise
    // chain, so a fixed tick only works while that chain stays exactly one deep.
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith('#3b82f6'));
    const f = els();
    expect(f.hex.value).toBe('#3b82f6');
    expect([f.r.value, f.g.value, f.b.value]).toEqual(['59', '130', '246']);
  });

  it('keeps the current color when the pick is canceled', async () => {
    window.EyeDropper = class {
      open() {
        return Promise.reject(new DOMException('canceled', 'AbortError'));
      }
    };
    const onChange = vi.fn();
    const picker = initColorPicker(document, onChange)!;
    picker.setColor('#22c55e');
    onChange.mockClear();

    btn().click();
    // A canceled pick has no observable outcome to wait for, so settle the
    // rejection explicitly and then assert nothing happened.
    await Promise.resolve();
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    expect(els().hex.value).toBe('#22c55e');
  });
});
