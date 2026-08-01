// Tiny typed query helpers, used by the tool runtime (main.ts, labels.ts) and by
// a consuming site's own script through the @sep alias.
//
// They live in lib/ rather than tool/ because they are a shared seam: the site's
// runtime imports them too, and depending on another repo's *tool internals* is
// the kind of coupling that breaks quietly when those internals move.
//
// The point of both is the return type. `root.querySelector(sel)!` is the usual
// shorthand and it lies: it types a possible null as present, so a renamed
// attribute becomes a null-dereference at runtime instead of an error at the call
// site. These return `T | null` and `T[]`, so callers handle absence explicitly —
// which is also what lets one script serve pages that render different markup.

export function $<T extends HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

export function $$<T extends HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(selector)];
}
