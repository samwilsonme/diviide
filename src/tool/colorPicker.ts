// The Advanced color picker: a saturation/value square + a hue bar + numeric
// fields that switch between HEX, RGB, and HSL. Picks in HSV but emits 6-digit
// hex (onChange); setColor() syncs it to an external selection (a swatch click).
import {
  hsvToHex,
  hexToHsv,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  parseColor,
} from '../lib/colorConvert';

type Format = 'hex' | 'rgb' | 'hsl';

// The EyeDropper API (Chromium only) is not in TypeScript's DOM lib yet.
declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

// Look up every element the picker needs in one pass. Returns null when any is
// missing (the page doesn't render the picker section); the `as T` cast is safe
// because a missing element short-circuits the whole lookup to null.
function pickerElements(root: ParentNode) {
  let complete = true;
  const el = <T extends Element>(selector: string): T => {
    const found = root.querySelector<T>(selector);
    if (!found) complete = false;
    return found as T;
  };
  const els = {
    sv: el<HTMLElement>('[data-sv]'),
    svThumb: el<HTMLElement>('[data-sv-thumb]'),
    hue: el<HTMLElement>('[data-hue]'),
    hueThumb: el<HTMLElement>('[data-hue-thumb]'),
    formatSelect: el<HTMLSelectElement>('select[data-color-format]'),
    hexField: el<HTMLInputElement>('input[data-color-hex]'),
    rgbR: el<HTMLInputElement>('input[data-rgb-r]'),
    rgbG: el<HTMLInputElement>('input[data-rgb-g]'),
    rgbB: el<HTMLInputElement>('input[data-rgb-b]'),
    hslH: el<HTMLInputElement>('input[data-hsl-h]'),
    hslS: el<HTMLInputElement>('input[data-hsl-s]'),
    hslL: el<HTMLInputElement>('input[data-hsl-l]'),
    hexGroup: el<HTMLElement>('[data-format-fields="hex"]'),
    rgbGroup: el<HTMLElement>('[data-format-fields="rgb"]'),
    hslGroup: el<HTMLElement>('[data-format-fields="hsl"]'),
  };
  return complete ? els : null;
}

export function initColorPicker(
  root: ParentNode,
  onChange: (hex: string) => void,
  // Ties every listener below to the caller's lifetime. Optional so a consumer
  // embedding the picker on its own can skip it and let the page unload clean up.
  signal?: AbortSignal
): { setColor: (hex: string) => void } | null {
  const els = pickerElements(root);
  if (!els) return null;
  const { sv, svThumb, hue, hueThumb, formatSelect, hexField } = els;
  const rgb = { r: els.rgbR, g: els.rgbG, b: els.rgbB };
  const hslFields = { h: els.hslH, s: els.hslS, l: els.hslL };
  const groups = { hex: els.hexGroup, rgb: els.rgbGroup, hsl: els.hslGroup };

  let h = 0;
  let s = 0;
  let v = 1;
  const currentHex = (): string => hsvToHex(h, s, v);

  // Visuals only — never touch the fields (see the sync* functions).
  function syncVisuals(): void {
    // SV square: solid hue, white->transparent (saturation), transparent->black (value).
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hsvToHex(h, 1, 1)}`;
    svThumb.style.left = `${s * 100}%`;
    svThumb.style.top = `${(1 - v) * 100}%`;
    svThumb.style.backgroundColor = currentHex();
    hueThumb.style.left = `${(h / 360) * 100}%`;
    // role="slider" requires aria-valuenow; pair it with the friendlier text.
    sv.setAttribute('aria-valuenow', String(Math.round(s * 100)));
    sv.setAttribute('aria-valuetext', currentHex());
    hue.setAttribute('aria-valuenow', String(Math.round(h)));
    hue.setAttribute('aria-valuetext', `hue ${Math.round(h)}`);
  }
  function syncHex(): void {
    hexField.value = currentHex();
  }
  function syncRgb(): void {
    const { r, g, b } = hexToRgb(currentHex());
    rgb.r.value = String(r);
    rgb.g.value = String(g);
    rgb.b.value = String(b);
  }
  function syncHsl(): void {
    const { h: hh, s: ss, l: ll } = hexToHsl(currentHex());
    hslFields.h.value = String(Math.round(hh));
    hslFields.s.value = String(Math.round(ss * 100));
    hslFields.l.value = String(Math.round(ll * 100));
  }
  // Refresh every field group except the one the user is editing.
  function syncFields(except?: Format): void {
    if (except !== 'hex') syncHex();
    if (except !== 'rgb') syncRgb();
    if (except !== 'hsl') syncHsl();
  }
  const emit = (): void => onChange(currentHex());

  // Every interaction does the same three things: repaint the thumbs/gradients,
  // refresh the numeric fields except the group being typed into, and publish the
  // new hex. setColor() below is the one deliberate exception — it syncs the
  // picker *from* an external selection, so it must not emit and re-announce it.
  function commit(except?: Format): void {
    syncVisuals();
    syncFields(except);
    emit();
  }

  // Read a numeric field, clamped to [0,max], or null when blank/invalid.
  function readNum(el: HTMLInputElement, max: number): number | null {
    const n = Math.round(Number(el.value));
    return Number.isFinite(n) && el.value.trim() !== '' ? Math.max(0, Math.min(max, n)) : null;
  }

  // Drag helper: fire onMove on pointerdown and while the pointer is captured.
  function draggable(el: HTMLElement, onMove: (e: PointerEvent) => void): void {
    el.addEventListener(
      'pointerdown',
      (e) => {
        // Primary button and primary pointer only: a right-click opening the
        // context menu, or a second simultaneous touch, must not jump (and
        // persist) the color.
        if (e.button !== 0 || !e.isPrimary) return;
        el.setPointerCapture(e.pointerId);
        onMove(e);
      },
      { signal }
    );
    el.addEventListener(
      'pointermove',
      (e) => {
        if (el.hasPointerCapture(e.pointerId)) onMove(e);
      },
      { signal }
    );
  }
  const frac = (value: number, min: number, size: number): number =>
    Math.max(0, Math.min(1, (value - min) / size));

  draggable(sv, (e) => {
    const rect = sv.getBoundingClientRect();
    s = frac(e.clientX, rect.left, rect.width);
    v = 1 - frac(e.clientY, rect.top, rect.height);
    commit();
  });
  draggable(hue, (e) => {
    const rect = hue.getBoundingClientRect();
    h = frac(e.clientX, rect.left, rect.width) * 360;
    commit();
  });

  // Hex field: apply as soon as it parses (paste is instant), without rewriting
  // what the user typed; revert on blur if it never became valid.
  hexField.addEventListener(
    'input',
    () => {
      const hex = parseColor(hexField.value);
      if (!hex) return;
      ({ h, s, v } = hexToHsv(hex));
      commit('hex');
    },
    { signal }
  );
  hexField.addEventListener(
    'blur',
    () => {
      if (!parseColor(hexField.value)) syncHex();
    },
    { signal }
  );

  // R/G/B fields: recompute from all three on any edit.
  function fromRgb(): void {
    const r = readNum(rgb.r, 255);
    const g = readNum(rgb.g, 255);
    const b = readNum(rgb.b, 255);
    if (r === null || g === null || b === null) return;
    ({ h, s, v } = hexToHsv(rgbToHex(r, g, b)));
    commit('rgb');
  }
  for (const el of [rgb.r, rgb.g, rgb.b]) {
    el.addEventListener('input', fromRgb, { signal });
    el.addEventListener('blur', syncRgb, { signal });
  }

  // H/S/L fields: recompute from all three on any edit.
  function fromHsl(): void {
    const hh = readNum(hslFields.h, 360);
    const ss = readNum(hslFields.s, 100);
    const ll = readNum(hslFields.l, 100);
    if (hh === null || ss === null || ll === null) return;
    ({ h, s, v } = hexToHsv(hslToHex(hh, ss / 100, ll / 100)));
    commit('hsl');
  }
  for (const el of [hslFields.h, hslFields.s, hslFields.l]) {
    el.addEventListener('input', fromHsl, { signal });
    el.addEventListener('blur', syncHsl, { signal });
  }

  // Eyedropper: a system-level pick from anywhere on screen. The button is
  // optional and ships hidden; it only appears where the API exists (Chromium).
  const dropperBtn = root.querySelector<HTMLButtonElement>('button[data-eyedropper]');
  const EyeDropperCtor = typeof window === 'undefined' ? undefined : window.EyeDropper;
  if (dropperBtn && EyeDropperCtor) {
    dropperBtn.hidden = false;
    dropperBtn.addEventListener(
      'click',
      async () => {
        try {
          const { sRGBHex } = await new EyeDropperCtor().open();
          ({ h, s, v } = hexToHsv(sRGBHex));
          commit();
        } catch {
          // The pick was canceled (Escape): keep the current color.
        }
      },
      { signal }
    );
  }

  // Format switch: show one group, refresh its (now visible) values.
  function showFormat(fmt: Format): void {
    groups.hex.hidden = fmt !== 'hex';
    groups.rgb.hidden = fmt !== 'rgb';
    groups.hsl.hidden = fmt !== 'hsl';
    syncFields();
  }
  formatSelect.addEventListener('change', () => showFormat(formatSelect.value as Format), {
    signal,
  });

  // Keyboard: saturation/value on the square, hue on the bar.
  sv.addEventListener(
    'keydown',
    (e) => {
      let handled = true;
      if (e.key === 'ArrowLeft') s = Math.max(0, s - 0.02);
      else if (e.key === 'ArrowRight') s = Math.min(1, s + 0.02);
      else if (e.key === 'ArrowUp') v = Math.min(1, v + 0.02);
      else if (e.key === 'ArrowDown') v = Math.max(0, v - 0.02);
      else handled = false;
      if (handled) {
        e.preventDefault();
        commit();
      }
    },
    { signal }
  );
  hue.addEventListener(
    'keydown',
    (e) => {
      let handled = true;
      if (e.key === 'ArrowLeft') h = (h - 4 + 360) % 360;
      else if (e.key === 'ArrowRight') h = (h + 4) % 360;
      else handled = false;
      if (handled) {
        e.preventDefault();
        commit();
      }
    },
    { signal }
  );

  function setColor(hex: string): void {
    ({ h, s, v } = hexToHsv(hex));
    syncVisuals();
    syncFields();
  }

  syncVisuals();
  showFormat((formatSelect.value as Format) || 'hex');
  return { setColor };
}
