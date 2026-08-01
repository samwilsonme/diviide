// Single source of truth for site/brand metadata.
// Authored as .js (with a sibling site.d.ts for types) so plain-Node consumers
// can import it alongside the Astro/TS app without a TypeScript build step.
// This is the open-source/public brand record;
// the private site composes its own branding via the shell props rather than
// editing this file. Keep copy human and free of em dashes.

export const SITE = {
  baseUrl: 'https://divii.de',
  name: 'Diviide',
  author: 'Sam Wilson',
  authorId: 'https://divii.de/#sam',
  githubRepo: 'https://github.com/samwilsonme/diviide',
  githubProfile: 'https://github.com/samwilsonme',
  // Where bug reports and questions go. Both were written out by hand in several
  // places (the site's FAQ, its privacy page, a guide) before living here.
  issuesUrl: 'https://github.com/samwilsonme/diviide/issues',
  contactEmail: 'hello@divii.de',
  coffeeUrl: 'https://buymeacoffee.com/samwilsonme',
  defaultTitle: 'Bookmark Separators to Organize Your Bookmarks Bar | Diviide',
  defaultDescription:
    'Bring order to your bookmarks bar with bookmark separators. Pick a color, choose a separator, drag it onto your bar, and spot every group at a glance. Free and open source.',
  defaultOgImage: '/og/default.png',
};
