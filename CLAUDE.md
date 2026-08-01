# CLAUDE.md

Guidance for AI agents (and humans) working in this repo. For the full architecture write-up, read
`README.md` — this file covers commands, conventions, and the gotchas README doesn't call out.

## What this is

Diviide is a config-driven **Astro 7 static site** for making bookmark-bar separators in any color.
Every page is prerendered; the only client JavaScript is the vanilla-TS tool runtime
(`src/tool/main.ts`). There is no UI framework. The entire catalog (icons, colors, categories, and
the headline counts) is derived from a single file: `public/config.json`. See **README.md →
Architecture** for how the favicon technique (query-based bookmark URLs + the pre-paint bootstrap)
and the config-driven build fit together.

This repo is the **open-source separator tool** and runs standalone (the root opens straight into
the tool). The marketing homepage and guides live in a separate private site that consumes this repo
as a git submodule and extends it by composition — so keep this repo focused on the tool, and keep
the shared pieces (Base layout, Header/Footer, theme.css, ToolApp, the lib modules) generic and
prop/slot-driven rather than hard-coding site-specific content.

## Commands

| Command                            | What it does                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm run dev`                     | Astro dev server (http://localhost:4321)                                       |
| `pnpm run build`                   | `astro check && astro build`                                                   |
| `pnpm run test:run`                | Vitest once (what CI runs)                                                     |
| `pnpm run test:favicons`           | End-to-end favicon check in real Chrome (needs a build; headed, ~10s per flow) |
| `pnpm run lint`                    | ESLint                                                                         |
| `pnpm run lint:copy`               | Tone-of-voice rules (American English, no em dashes, no "colorful")            |
| `pnpm run format` / `format:check` | Prettier write / verify                                                        |

- Node 24 (`.nvmrc`). pnpm is the package manager (pinned in the `packageManager` field). CI
  (`.github/workflows/ci.yml`) runs **lint → lint:copy → format:check → test:run → build**. This repo is not
  deployed on its own — divii.de is built from the private site that consumes it as a submodule — so
  CI owns the build as the tool's only compile check.

- **TypeScript stays on 6.x for now (deliberate):** TypeScript 7 (the native compiler) shipped
  without a programmatic API, and both `astro check` (this repo's only type gate — `tsc` is never
  run directly) and `typescript-eslint` depend on that API. Revisit once TypeScript 7.1 lands
  (~Oct 2026) **and** `@astrojs/check` + `typescript-eslint` support it.

- **Lockfile (`pnpm-lock.yaml`):** platform-independent — pnpm records every platform's optional
  deps (including the `@emnapi/*` wasm-runtime peers Tailwind v4 pulls in), so a lock generated on
  macOS installs cleanly in CI's Linux `pnpm install --frozen-lockfile`. Just run `pnpm install` and
  commit the updated lock; no Docker/Linux regen dance is needed (it was, under npm, whose macOS lock
  omitted those peers and broke `npm ci`).

## The favicon invariant (do not weaken)

Browsers key a bookmark's favicon to the exact URL (including the query). Three rules keep saved
bookmarks frozen forever:

1. Static HTML must never carry a favicon `href` — the pre-paint bootstrap
   (`src/components/PrePaintBootstrap.astro`) owns the `<link id="diviide-favicon">`.
2. Never re-tint the live favicon while the page sits on a bookmark URL
   (`/separators/?icon=…&color=…`) — see the guard in `applyColor()` (`src/tool/main.ts`) and the
   parking logic in `src/lib/favicon.ts`, which was tuned empirically. Port it, don't redesign it.
3. Never redirect a bookmark URL — the redirect target's favicon would overwrite the saved one.

`src/lib/favicon.test.ts` and `bookmarkUrl.test.ts` are the executable spec for all of this, and
`pnpm run test:favicons` verifies the end result against real Chrome's favicon database — run it
after touching anything in this section.

## Single source of truth

`public/config.json` holds `colors`, `categories`, and `icons`. The headline counts (separator,
color, and combination totals) are **derived at build time** via
`src/lib/separatorCounts.ts` — the separator count from config, the color count from the full 24-bit
hex space the Advanced wheel exposes (the 18 `colors` in config are just the preset swatches). The
runtime never fetches config; keywords and palette are baked into the HTML. **Prose in README and a
test assertion are hardcoded, though** (see Gotchas).

Reuse these utilities instead of reinventing them:

- `bookmarkUrl()` / `parseBookmarkUrl()` — `src/lib/bookmarkUrl.ts`. The one URL contract.
- `startSeparatorDrag()` — `src/lib/separatorDrag.ts`. The one drag contract, every drag source.
- Styling is **pure Tailwind v4** + OKLCH CSS variables in `src/styles/theme.css` (shared with the
  private site). No `tailwind.config`. Icons paint via the `separator` utility (CSS mask + `--icon-color`).
- UI glyphs come from `src/components/icons/Lucide.astro` (inlined path data) — don't add an icon
  library.

## The downstream seam — exports that look dead but aren't

This repo is designed to be consumed as a read-only submodule by other projects, each importing
through its own path alias. The site at [divii.de](https://divii.de) is one such consumer.

So several exports here have **zero use inside this repo**. A "remove unused code" pass, human or
AI, that greps only this checkout will flag them as dead. They are not dead: they are **this repo's
public API**, and deleting one compiles cleanly here and then breaks a consumer on its next
submodule pull, with no error on this side to warn you.

**Treat everything in the list below as public API. Do not remove it as dead code, and do not
change its name or shape without treating that as a breaking change.** A review in July 2026 flagged
eight of these as "obviously dead" — `--separator-color`, `--radius-2xl` / `--radius-3xl`,
`--color-on-accent`, the `chevron-right` and `share-2` Lucide entries, and `describeLabelFit()`.
Every one was live in a consumer. If you maintain a consumer yourself, grep it (and every other one)
before removing anything here that looks unused.

Public API with no internal caller here:

- `src/lib/heroTiles.ts` — `heroTileSources()`, `buildHeroTiles()` (the site's homepage hero backdrop).
- `src/lib/schema.ts` — `personSchema()`, `webSiteSchema()`, `articleSchema()`, `videoObjectSchema()`,
  `faqSchema()` (the guides' JSON-LD). Note `breadcrumbSchema()` and `webApplicationSchema()` **are**
  used here, so don't assume the whole module is safe or unsafe as a unit.
- `src/lib/utils.ts` — `isMac()` (the site's ⌘-vs-Ctrl keyboard hint). `capitalize()` is used here.
- `src/lib/storage.ts` — `STORAGE_KEYS.videoTime` (the site remembers the demo-video position).
- `src/lib/colors.ts` — `DEFAULT_COLOR` (the name; `DEFAULT_COLOR_HEX` is the one used internally).
- `src/content/site.js` (+ `site.d.ts`) — `SITE.contactEmail` and `SITE.issuesUrl` (the site's privacy
  page, a guide, and the FAQ copy).
- `src/lib/railClasses.ts` — `RAIL_LINK_CLASS`, `SPY_ACTIVE`, `SPY_INACTIVE` (the site's scroll-spied
  guide rails). `RAIL_BUTTON_CLASS` **is** used here (CategoryList).
- `src/styles/theme.css` — the `separator-bob` keyframe, the `--dot` token, the `bleed-x` and
  `toast-in` utilities, and the `--ease-reveal` / `--dur-reveal` / `--spacing-sidebar` tokens (the
  site's animated hero mark, dot-grid texture, full-bleed hero, toasts, and split-shell reveal).
- `src/lib/faviconPaint.ts` — the whole module. Imported by the site's `iconTemplates.ts` and, more
  unusually, by **both** repos' `scripts/verify-favicons.mjs` under plain Node. **It must stay
  import-free** or that stops working; `faviconPaint.test.ts` pins the rule.
- `src/lib/dom.ts` — `$` / `$$`. The site's runtime modules use them too.
- `src/lib/dialog.ts` — `wireDialog()`. Used here for the tool's drawer, and by the site for its
  video modal, image lightbox and its own drawer.
- `src/lib/flashLabel.ts` — used here by the label copy button, and by the site's share button.
- `src/lib/routes.ts` — `isActivePath()`. Used by `Header`/`Footer` here and by the site's footer.
- `src/lib/colors.ts` — `swatchHex()` (the site's two palette surfaces read swatches with it).
- `src/components/NotFoundContent.astro` — the site's own 404 page renders it.
- `astro.fonts.mjs` — imported by **both** repos' `astro.config.mjs`. Changing a weight or subset
  here changes both builds, which is the point.
- `src/lib/labelFormat.ts` — `describeLabelFit()`. Reachable from **one consumer only**, which
  mirrors the tool's fit meter. Neither this repo nor the site calls it, which makes it the easiest
  export in this list to delete by mistake — it was, in the review above.
- `src/lib/logo.ts` — the whole module. The wordmark's path data, drawn by `Logo.astro` here and by
  the site's `scripts/generate-og-images.js` (which resolves the paints to literal hexes, because
  resvg applies no CSS). **Import-free**, like `faviconPaint.ts`, so plain Node can load it.
- `scripts/lint-copy.mjs` — `lintCopy()` / `report()`. The tone-of-voice engine; the site's own
  `scripts/lint-copy.mjs` imports it and supplies its own sources. Same engine/consumer split as
  `verify-favicons.mjs`.
- `src/test/setup.ts` — not an export, but load-bearing downstream all the same: the site's
  `vitest.config.ts` points `setupFiles` at this exact path inside the submodule. Renaming or moving
  it breaks the site's entire test run with no type or lint error to warn you.

The same protection covers the shell's slots and defaulted props — intentional consumer seams,
whether or not anything fills them today:

- `Base.astro` slots — `head`, `header`, `footer`. The site uses `head` and `footer`
  (`SiteLayout.astro`); `header` is held open (the site customizes the default `Header` via
  `navLinks` instead).
- `Header.astro`'s `logo` slot and `Footer.astro`'s `tagline` slot — no caller anywhere yet, held
  open for site branding. The site **does** override `Footer`'s default slot (its own link cluster).
- `PrePaintBootstrap.astro`'s `defaultHex` / `defaultIcon` props — overrides for a consumer whose
  brand default differs from this repo's; the defaults preserve today's behavior. `Base.astro`
  accepts and forwards both (it did not, for a while, which made the seam unreachable).
- `ColorPicker.astro`'s `showAdvanced` prop — `false` renders only the preset swatches, for a surface
  that reuses this exact markup without the HSV disclosure. Defaults to `true`.
- `initTool()` returns a **teardown**, not `void`. A consumer that mounts the tool into a page it
  later replaces should call it; the DOM suites rely on it for per-test isolation.

Genuinely dead exports found in review — `filterIcons()` in `src/lib/icons.ts` and
`SupportCallout.astro` (superseded by the site's own `SupportCard`), unused in every known
consumer — were removed. That's the bar: unused _everywhere_, not just here.

## Gotchas — numbers that must stay in sync

When you add or remove an icon, color, or category, these do **not** auto-update and will break:

- **`src/test/config-integrity.test.ts`** asserts `expect(Object.keys(config.icons)).toHaveLength(182)`.
  Bump this in lockstep with the icon count or the test fails.
- **`README.md` prose** hardcodes `182`, `16.7 million colors`, `3 billion+ combinations`, `8 categories`. Update by hand.
- **`package.json` `description`** also hardcodes the icon count (`config-integrity` pins it).
- **Every icon in `config.json` needs a source SVG** in `assets/icons/` — `config-integrity` checks
  this, and the build bakes each shape into the HTML as a data-URI mask via `src/lib/iconTemplates.ts`
  (there are no generated icon files).
- **`public/og/default.png` is not generated here** — it's a checked-in copy of the card the private
  site's `scripts/generate-og-images.js` produces (this repo deliberately carries no raster
  dependency). When the brand card changes, regenerate it there and copy it across. The copy step is
  manual and has been missed before, so the site's `generate-og-images.test.js` now compares the two
  files and tells you to re-copy; it runs on any `generate` or `build` over there.
- **README prose is American English** (`color`), matching the code identifiers and UI copy. So are
  code comments — `pnpm run lint:copy` (`scripts/lint-copy.mjs`) sweeps every `.astro`, `.ts`, `.js`
  and `.mjs` under `src/` and `scripts/`, plus this repo's `README.md` and `CLAUDE.md` (and a
  parent-directory `CLAUDE.md` if one exists, which it will not in a standalone clone), for
  British spellings, em dashes in rendered copy, and "colorful". It runs in CI next to ESLint. It
  used to be a Vitest suite, which made a typo in a code comment a _test_ failure; the site imports
  the same engine rather than keeping a second copy of the word list.

## Conventions

- Tests are co-located as `*.test.ts` (Vitest). Default environment is node; DOM suites start with a
  `// @vitest-environment jsdom` pragma. Shared setup in `src/test/setup.ts` (localStorage mock).
  The suites resolve their own paths from the test file rather than the working directory, so
  `pnpm run test:run` behaves the same wherever it is invoked from. One exception, with a comment
  saying so: `prePaintBootstrap.dom.test.ts` is cwd-relative because jsdom rebases `import.meta.url`
  onto its `http://` document URL, which `fileURLToPath` then rejects.
- **Rendering a component in a test:** `astro/container` renders a real `.astro` component to HTML
  inside Vitest (see `config-integrity.test.ts`, which uses it to assert a markup contract on the
  rendered DOM instead of grepping the source for class strings). It needs the **node** environment
  — under jsdom the container resolves a different Astro build and throws "No valid renderer was
  found for this file extension". Parse the output with `new JSDOM(html)`.
- **Low-memory environments:** the config runs test files in parallel, which is right for a dev
  machine and for CI. In a constrained container (a couple of GB, or one already hosting a
  TypeScript language server) the fork pool can fail to start workers, with a "Timeout waiting for
  worker to respond" that looks like a hang. Pass `--no-file-parallelism`, or run a few files at a
  time; don't change the config, which would slow every real run to accommodate a case neither the
  dev machine nor CI hits.
- Strict TypeScript (`astro check`): no unused vars/params.
- Copy is plain and **uses no em dashes**, and is **American English** — including code comments.
  (Comments used to be exempt, which left the sibling site mixing "colour" into files whose
  identifiers all say `color`.)

## Skills

Step-by-step skills live in `.claude/skills/`. Use them for these multi-file workflows:

- **add-icon** — add a new separator/icon (SVG + config + count bumps).
- **add-category** — add a separator category.
- **preflight-checks** — run lint → format → test → build in the right order before committing.
