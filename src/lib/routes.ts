// Route helpers shared by the shell's chrome (Header, Footer) and by a consuming
// site's own chrome, so "is this link the current page?" is answered one way
// everywhere. Duplicating it is how the site's footer ended up styling an active
// link without also setting aria-current.

/**
 * Whether `to` is the page currently being rendered. Trailing slashes are
 * equivalent: Astro serves /privacy/ but links are often written /privacy, and a
 * mismatch there silently means no nav item ever looks active.
 *
 * Callers should pair the active style with `aria-current="page"` — the visual
 * state and the announced state describe the same thing.
 */
export function isActivePath(currentPath: string, to: string): boolean {
  const strip = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  return strip(currentPath) === strip(to);
}
