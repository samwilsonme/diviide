// Shared Tailwind recipes for the sidebar cards' compact form fields, so the
// ColorPicker's and LabelSection's controls stay identical by construction
// instead of by hand-synced copies of the same class strings.
//
// Fields signal focus by swapping their border to the accent, not with the ring
// that every other control gets (see the base-layer rule in styles/theme.css):
// stacking a ring on a border swap reads as double emphasis, and the ring's offset
// would be clipped by the sidebar's overflow-hidden panes.

/**
 * Full-width text input (search, label text). Callers add their own padding,
 * since each has different room for adornments.
 */
export const textField =
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent text-base placeholder:text-muted-foreground transition-colors focus-visible:border-accent-live focus-visible:outline-none md:text-sm dark:bg-input/30';

/** Numeric field (R/G/B, H/S/L): centered mono digits, no spinners. */
export const numInput =
  'h-8 w-full rounded-md border border-input bg-transparent text-center font-mono text-xs [appearance:textfield] focus-visible:border-accent-live focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/** Tiny mono caption beside/above a field. */
export const fieldCaption = 'font-mono text-2xs text-muted-foreground/80';

/** Compact mono select/input chrome; callers add their width (w-full / shrink-0). */
export const selectField =
  'h-8 rounded-md border border-input bg-transparent px-1.5 font-mono text-2xs text-muted-foreground focus-visible:border-accent-live focus-visible:outline-none';

/** Round white picker thumb (SV square, hue bar); callers add size and position. */
export const pickerThumb =
  'pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]';
