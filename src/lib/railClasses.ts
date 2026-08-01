// One recipe for every left-rail item: the tool's category buttons here, and
// the private site's guides-hub rail + article TOC links (imported through the
// @sep/* alias). The active state is a left accent border + darker text.
// RAIL_LINK_CLASS / SPY_ACTIVE / SPY_INACTIVE have no caller in this repo —
// they are downstream seams for the site's scroll-spied anchor rails.
const RAIL_BASE =
  'flex items-center justify-between gap-2 border-l-2 border-border py-1.5 pr-1 pl-3.5 text-sm transition-colors';

/** Anchor rails: static link look; the spy swaps the SPY_* sets on top. A
 *  trailing element (e.g. a count badge) right-aligns via the flex layout. */
export const RAIL_LINK_CLASS = `${RAIL_BASE} text-muted-foreground hover:text-foreground`;
export const SPY_ACTIVE = ['border-accent-live', 'font-medium', 'text-foreground'];
export const SPY_INACTIVE = ['border-border', 'text-muted-foreground'];

/** Button rails (tool category list): active state driven by aria-pressed. */
export const RAIL_BUTTON_CLASS = `group w-full text-left ${RAIL_BASE} aria-pressed:border-accent-live`;
