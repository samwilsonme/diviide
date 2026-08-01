# Diviide

**Separators that organize your bookmarks bar.** Pick a color, choose from 182 separator icons, and drag one straight onto your bar. Free and open source.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Astro](https://img.shields.io/badge/Astro-7-ff5d01.svg)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8.svg)](https://tailwindcss.com)
[![Tests: Vitest](https://img.shields.io/badge/Tests-Vitest-6e9f18.svg)](https://vitest.dev)

![Diviide: bookmark separators, done right](public/og/default.png)

## Try it

**Use it at [divii.de](https://divii.de).** It runs in your browser: no install, no extension, no account. Pick a color, choose a separator, and drag it onto your bookmarks bar. Done.

The site also has [short, practical guides](https://divii.de/guides/) on everything from adding your first separator to organizing your whole bar.

## The problem

A full bookmarks bar is hard to scan. Every icon is tiny, nothing marks where one group of links ends and the next begins, and finding the right bookmark means reading the whole row.

Separators fix that. A separator is a bookmark that marks where one group of links ends and the next begins, instead of linking to a page. Drop one at the start of each group, and the bar reads at a glance.

The catch is that the existing ways to make separators fall short:

- **Complex tools** want 3 to 5 clicks per separator, hidden behind confusing navigation
- **Simple tools** give you 1 or 2 styles and no say in the color
- **Ad-heavy sites** bury the separators under ads and tracking cookies
- **Most of them** skip the page visit, so Chrome never caches the icon and the separator decays into a blank gray globe

Diviide fixes all four.

## Features

- **3 billion+ combinations**: 182 separators in any of 16.7 million colors (an 18-swatch preset palette plus an Advanced color wheel)
- **Drag, drop, done**: no menus to click through; drag a separator straight onto your bookmarks bar
- **Icons that stick**: the browser caches the icon the moment you drag, so it keeps its color forever (no gray globes, ever; uses a `history.pushState()` technique)
- **8 categories**: Shapes, Arrows, Numbers, Finance, Math, Brackets, Symbols, Separators
- **Instant search**: press `/` and start typing
- **Recent separators**: a "Recently used" category keeps your last 50 one click away
- **Optional labels**: add text to a separator, ideal for titling a group of bookmarks inside a folder
- **First-visit onboarding**: a short walkthrough the first time you open the tool
- **Dark mode**: follows your system preference
- **Privacy-first**: no ads, no tracking, no cookies
- **Open source**: MIT licensed, so you're free to use it, adapt it, or contribute
- **Static and tiny**: the whole tool is prerendered HTML plus ~8KB (gzip) of dependency-free JavaScript

## Browser support

**Diviide is built for Chrome and other Chromium browsers.** Chrome, Edge, Brave, and Arc cache a bookmark's favicon from the live page at drag time (exactly what Diviide relies on), so a separator keeps its icon and color the instant you drop it. Opera works the same way with one extra step (it asks you to confirm the name on every drop; a blank name is fine). Vivaldi is the Chromium exception: its bookmarks bar shows a gray globe and the address instead of the dragged icon, though separators hold normally inside folders.

Safari and Firefox resolve a bookmark's favicon differently: they fetch it from the network on visit rather than caching the live one at drag. In Safari that means confirming the name on drop and clicking the bookmark once before the icon appears; after that first open it holds (tested through restarts), with minor quirks like a background tint on some icons. Firefox stamps a bookmark with the icon of the source page and ignores the one set in JavaScript, so a dragged separator reverts on click and cannot be recovered. Closing that gap would require a full page navigation per selection, which is at odds with the tool's instant, client-side model. That path was prototyped and parked.

## For developers

Everything from here on is about the code: running it, how the favicon technique works, the architecture, and how to build on it or contribute.

## Quick start

Run your own copy locally. Requires [Node 24](.nvmrc) and [pnpm](https://pnpm.io) (the version is
pinned in `package.json`; `corepack enable` sets it up for you):

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm run dev
```

Then open [http://localhost:4321](http://localhost:4321) and drag a separator onto your bookmarks bar.

### Other scripts

```bash
pnpm run build         # Type-check (astro check) and build
pnpm run preview       # Preview the production build locally
pnpm run test          # Run the test suite in watch mode (Vitest)
pnpm run test:run      # Run the test suite once (used in CI)
pnpm run coverage      # Run tests with a V8 coverage report
pnpm run test:favicons # Drive real Chrome through the drag flows and assert its favicon DB (needs a build)
pnpm run lint          # Lint with ESLint
pnpm run format        # Format with Prettier (format:check to verify only)
```

## How it works

Most bookmark tools fail because they never give the browser a page to associate the favicon with. Chrome keys a bookmark's favicon to the **exact URL** the bookmark points at.

Diviide gives every separator/color combination its own URL, as a query string on one page:

1. Every combination has a unique bookmark URL: `/separators/?icon=<icon>&color=<hex>` (color is a hex, e.g. `f43f5e`). Query strings never hit the file system, so **one prerendered page serves every combination** on any static host: no per-separator pages, no rewrites.
2. When you drag a separator, the page parks itself on that URL via `history.pushState()` and sets the matching favicon, so the browser caches the pair.
3. When you later open the bookmark, a tiny pre-paint script recreates the same favicon from the query before anything renders, so the association can never be overwritten. The favicon is generated on the fly (the icon shape painted with the color and encoded as a `data:` URI), so it needs no stored file and any color works, not just the 18 presets.
4. Result: separators that keep their exact color forever, and creating new ones can never touch an existing bookmark.

## Tech Stack

- [Astro 7](https://astro.build) — static site generation; every page is prerendered HTML
- [TypeScript](https://www.typescriptlang.org/) — type safety (strict, `astro check`)
- [Tailwind CSS 4](https://tailwindcss.com) — styling (no config file, pure CSS tokens)
- [Vitest](https://vitest.dev) — testing

There is **no UI framework**: the tool's interactivity is a small set of vanilla-TS modules under `src/tool/` (entry: `main.ts`), and native `<dialog>`/popover replace component-library primitives. The runtime dependency list is Astro + Tailwind, full stop: the handful of animations the tool needs are hand-rolled keyframes in `src/styles/theme.css`.

## Architecture

Diviide is a prerendered static site. The grid, sidebar, and counts are baked in at build time from config; the client script only wires behavior.

### Config-driven content

`public/config.json` is the single source of truth for colors, categories, and separators (stored under the `icons` key). The 182-tile grid, the per-category counts, and the headline counts (182 separators, 16.7 million colors, 3 billion+ combinations) are derived **at build time** — the separator count from this config, the color count from the full 24-bit hex space the Advanced wheel exposes (see `src/lib/separatorCounts.ts`); the runtime never fetches config at all; everything it needs (search keywords, palette hexes) is baked into data attributes and the inline bootstrap. Each icon's color-agnostic shape template (`assets/icons/<icon>.svg`) is loaded as a string at build time (`src/lib/iconTemplates.ts`) and serves both the grid — every tile's CSS mask is baked in as an inline `data:` URI, so painting the catalog costs no icon requests — and the favicon, which is generated on the fly from the same shape and any color (see `src/lib/favicon.ts`); there is no per-color file matrix and no generated icon files at all. The Diviide and Buy-Me-a-Coffee wordmarks are inline SVGs (`src/components/Logo.astro`, `BmcLogo.astro`) whose lettering uses `currentColor` (flips with the theme) and whose accent shapes are painted from the live `--accent-live` CSS variable.

### Separator icons

The 182 separator shapes start as [Lucide](https://lucide.dev) icons, redrawn and extended in Figma to produce the variations the catalog needs — filled and outline weights, small and large sizes, and bespoke sets (numbers, brackets, arrows, math and finance symbols) that Lucide doesn't ship out of the box. Each variation is exported as a single color-agnostic SVG to `assets/icons/<name>.svg`. At build time the app loads those source SVGs as strings (`src/lib/iconTemplates.ts`) and bakes each one into its grid tile as an inline `data:` URI CSS mask, so they can be live-tinted with no per-icon network requests (see [Styling](#styling)). Because the source SVG is used only for its shape (the mask's alpha channel), the fill color in the source file is irrelevant.

### Icon delivery: why the masks are inline data URIs

There are four ways to deliver a masked-icon catalog like this one. Here is the trade-off of each, and why Diviide inlines the masks as data URIs:

1. **Per-color file matrix.** One SVG per icon per palette color (`red/pipe.svg`, `blue/pipe.svg`, ...). Simple to serve, but the catalog scales as shapes x colors, custom hexes are impossible, and a palette tweak regenerates every file. A non-starter once tinting can be done in CSS.
2. **One mask file per icon.** One color-agnostic SVG per icon in `public/icons/`, painted with `mask-image: url('/icons/<name>.svg')` and tinted by `background-color: var(--icon-color)`. This solves the color dimension (any hex, one file set) but costs one HTTP request per icon: 183 requests just to paint the grid, re-validated or re-fetched on every cold visit.
3. **Sprite sheet.** All shapes stitched into one image, each tile showing its slice via `mask-position` offsets. Cuts the requests to one, but adds a build step and per-tile offset arithmetic that breaks when any icon's size changes, and it still duplicates data the page already carries (see below).
4. **Inline data URIs — what Diviide uses.** Each tile's mask is baked into the prerendered HTML as `mask-image: url("data:image/svg+xml,...")`, built from the source templates by `src/lib/svgDataUri.ts`. Zero icon requests, no offset arithmetic, no generated files, and no JavaScript needed for the grid to paint.

The insight that settles it: the page **already ships every shape inline**. The pre-paint bootstrap inlines all the templates into `<head>` so the favicon can be painted synchronously for any bookmark URL. Fetching (or spriting) the same shapes again for the masks would pay twice for the same bytes, while inlining the masks costs almost nothing extra because brotli compresses the second copy against the first. Measured on the real build:

|                              | Mask files (method 2)   | Inline data URIs (method 4) |
| ---------------------------- | ----------------------- | --------------------------- |
| Requests to paint the grid   | 183 (1 HTML + 182 SVGs) | 1 (the HTML)                |
| Wire transfer, brotli        | ~126 KB                 | ~57 KB                      |
| Tool page HTML, raw / brotli | 372 KB / 48 KB          | 598 KB / 57 KB              |

The one real cost is raw (uncompressed) HTML size, which any compressing host absorbs. Tinting is unaffected throughout: masks use only the shape's alpha channel, so one CSS variable write recolors the whole catalog with no image reloads, whatever the delivery method.

#### At scale (the pre-decided successor)

Inline delivery is the right trade while the whole catalog is small; its cost grows with every icon shipped, not with what's on screen. The envelope is **enforced, not remembered**: `config-integrity.test.ts` fails the build when the source shapes pass 600 KB total (roughly 650 icons; page weight would near ~150 KB brotli) or any single SVG passes 5 KB. If the payload test ever trips, don't raise the threshold — switch to this design, whose decisions were settled on 2026-07-11 so the migration is execution, not debate:

- **Masks become hashed immutable URLs.** Import the source SVGs with `import.meta.glob(..., { query: '?url' })`; Vite emits `/_astro/<name>.<hash>.svg`, which the deploy config already caches forever. The grid keeps painting **without JavaScript** (a hard requirement), and no generate step returns — Vite owns the hashing.
- **Off-screen tiles defer their fetches** via `content-visibility: auto` on the grid sections, so a visit costs the visible tiles, not the catalog. Spike this first in Chrome/Firefox/Safari: whether skipped subtrees defer `mask-image` fetches is the one load-bearing unknown.
- **The favicon map goes O(1).** The bootstrap inlines only the default icon's template plus a name-to-URL manifest; a cold open of a non-default bookmark fetches its one ~1 KB shape and paints the tab icon a few milliseconds later (accepted trade — the bookmarks bar itself is unaffected, Chrome serves those from its own favicon database). Re-verify with `pnpm run test:favicons`.
- Everything else is untouched: mask + `--icon-color` tinting, the query-based bookmark URLs, the parking invariant, and the `templates` seams on `ToolApp`/`Base`.

The consuming site's extra icons (its `config.extra.json`) ride the same page and count toward the same envelope.

### Bookmark URLs and the favicon technique

The gray-globe fix lives in `src/lib/favicon.ts` and `src/lib/bookmarkUrl.ts`.

- **URL contract**: a bookmark points at `/separators/?icon={icon}&color={hex}` (`bookmarkUrl()`; color is a bare hex). The live tool page is the same path _without_ the query, so it is never mistaken for a bookmark URL.
- **Capture**: on drag, `selectFavicon()` parks the page on the bookmark URL via `history.pushState()` and sets the favicon, so the browser caches the pair. The page _stays_ parked (restoring immediately raced the capture); `restoreUrlAfterSelect()` moves it back just before the next color-change re-tint, which must never happen while the page sits on a URL a bookmark was saved with.
- **Revisit**: the pre-paint bootstrap (`src/components/PrePaintBootstrap.astro`, first in `<head>`) OWNS the `<link id="diviide-favicon">`. Static HTML carries **no favicon href** — a hardcoded default would let a served bookmark URL re-associate the default icon over the saved bookmark's frozen one. The bootstrap creates the link from the query when present, else from the persisted color.
- The custom drag ghost is built in `src/lib/dragImage.ts`; the one shared drag contract is `src/lib/separatorDrag.ts`.

**Why not redirects or a page per combination?** A redirect page (bookmark URL to a page that sets the favicon) corrupts saved favicons: Chrome attributes a client-redirected document's favicon updates to every same-document URL it passes through, so the redirect target's re-tint bleeds onto the saved bookmark. And a separately generated static page per combination is unnecessary once the pre-paint bootstrap owns the favicon and the combination lives in the query, since one prerendered page then serves them all.

### The client runtime

`src/tool/main.ts` (under 500 lines, no dependencies) wires everything: color selection (two CSS-variable writes re-tint the whole page), category/search filtering (`hidden` on prerendered tiles, including the "Recently used" pseudo-category, which re-sorts the grid newest-first with CSS `order`), labels, the first-visit banner, keyboard shortcuts, the mobile drawer (a native `<dialog>` the single sidebar node moves into), and the drag/click contract via event delegation. Selected color, recents (up to 50), and label text persist to `localStorage` through the safe wrappers in `src/lib/storage.ts`.

### Labels and bookmark width limits

A label rides on the native drag: type a label and the browser names the dropped bookmark after the anchor's hidden link text (see `applyLabels()` in `src/tool/labels.ts`); leave it blank for an icon-only bookmark. The title is a plain string rendered in the OS UI font (Segoe UI on Windows, San Francisco on macOS, the system default on Linux). A web page cannot read or set that font, and there is no per-bookmark styling, so the tool works with the string, not its appearance. Chrome (like Safari and Firefox) also collapses runs of whitespace and strips leading/trailing spaces from a saved title, so fills use visible glyphs (dash, dot, block, and the like), not spaces; a single separating space inside `- Work -` survives because it is neither leading, trailing, nor doubled.

The Advanced label controls decorate that string, padding it with a fill character, aligning it, wrapping it in end-caps, and holding it to a target length so it reads as a heading inside a folder. Presets (Dashes, Brackets, Blocks, Dots) set a whole look in one click, and Reset restores the plain default. Two Chromium caps bound how much of it shows before Chrome truncates with an ellipsis: a bookmarks-bar button is capped at `kMaxButtonWidth` = 150px ([`bookmark_bar_view.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/views/bookmarks/bookmark_bar_view.cc)), and a folder drop-down menu at `kMaxMenuWidth` = 400px ([`bookmark_menu_delegate.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/views/bookmarks/bookmark_menu_delegate.cc)). Those caps are why the length range is 10 to 60 (default 20, tuned to the ~150px bar), and why the Advanced preview renders in `system-ui` (the same OS UI font) and measures the label against the caps, showing the approximate width and turning amber then red as it starts to truncate in the bookmarks bar and then in a folder. The width model, presets, and the `describeLabelFit()`/`labelFitLevel()` helpers live in `src/lib/labelFormat.ts`; the section runtime is `src/tool/labels.ts`.

### Styling

Pure Tailwind v4 utilities plus OKLCH CSS variables defined in `src/styles/theme.css` (imported by `global.css`; the private site imports the same theme file to reuse the design system). Separators render as CSS masks (the `separator` utility) tinted by a single `--icon-color` variable, so changing the color repaints all 182 separator tiles with one variable write instead of swapping images.

### Color palette

The 18 colors in `public/config.json` are Tailwind's default palette sampled one per hue at the `500` shade. `500` is the vivid mid-shade that stays legible on the bookmarks bar in both light and dark themes. They're ordered as a continuous hue spectrum — red through rose, the same order Tailwind lists them — so the picker reads as a natural rainbow rather than an arbitrary set. Red sits beside orange; pink and rose land near the end because on the color wheel they wrap back around to red, and `slate` closes the set as a neutral. The values are stored as literal hex rather than referencing Tailwind tokens, so the palette stays self-contained and stable across Tailwind upgrades (v4 redefined its defaults in OKLCH, which would otherwise shift these hues).

### SEO and content

Every page's head (title, description, canonical, OG/Twitter, JSON-LD) is prerendered by the shared layout `src/layouts/Base.astro`, driven by the brand/site metadata in `src/content/site.js`. Pure JSON-LD builders live in `src/lib/schema.ts`. First-visit onboarding copy is stored as data in `src/content/steps.ts`.

The social card (`public/og/default.png`, also the image at the top of this README) is a checked-in copy of the card the private site's OG generator produces (its `scripts/generate-og-images.js`, SVG rasterized with resvg). This repo deliberately ships the PNG rather than the generator: one brand card doesn't justify carrying the raster dependency and font files here. When the brand card changes, regenerate it there and copy it across.

## Project Structure

```
diviide/
├── public/                    # config.json, robots.txt, og
├── assets/icons/              # source SVG templates (one per separator)
├── scripts/                   # verify-favicons (the real-Chrome favicon check) + lint-copy (the tone-of-voice rules)
├── astro.config.mjs
├── src/
│   ├── pages/                 # index + separators/ (the tool, canonical /separators/), license, 404
│   ├── layouts/Base.astro     # head/SEO + header/footer shell (slot-driven)
│   ├── components/
│   │   ├── tool/              # ToolApp + picker sections + grid (prerendered)
│   │   ├── icons/Lucide.astro # the handful of inlined UI glyphs
│   │   └── …                  # Header, Footer, Logo, PrePaintBootstrap, …
│   ├── tool/                  # main.ts + labels.ts + colorPicker.ts (the client runtime)
│   ├── lib/                   # bookmarkUrl, favicon, separatorDrag, storage, schema, …
│   ├── styles/                # global.css (Tailwind entry) + theme.css (design system)
│   ├── content/               # site (brand/SEO metadata), steps (onboarding)
│   └── test/                  # Vitest setup + config-integrity test
└── vitest.config.ts
```

## Testing, CI & Deployment

Tests run on [Vitest](https://vitest.dev), co-located next to the code they cover; DOM suites opt into jsdom with a `@vitest-environment` pragma. The favicon/bookmark contract tests (`src/lib/favicon.test.ts`, `bookmarkUrl.test.ts`) are the spec for the gray-globe fix — do not weaken them.

This repo is the open-source tool; it is **not deployed on its own**. The public site at [divii.de](https://divii.de) is built from a separate, private site that consumes this repo as a git submodule and extends it by composition.

**GitHub Actions** (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request: `lint` → `lint:copy` → `format:check` → `test:run` → `build`. `lint:copy` (`scripts/lint-copy.mjs`) is the tone-of-voice gate: it holds the source, the docs and the UI copy to American English, with no em dashes in anything a reader sees. The build (`astro check && astro build`) runs here because nothing else does — it's what verifies the tool still compiles before the downstream site pulls it in.

Want to host your own copy? **Any static host works** — run `pnpm run build` and serve `dist/`. No SPA fallback, rewrites, or server config needed: bookmark URLs are query strings on a real prerendered page.

## Building on it

This repo is designed to be consumed as well as run. [divii.de](https://divii.de) itself is a separate site that pulls this repo in as a git submodule and composes it — no fork, no patches. The seams it uses are available to any consumer:

- **The shell is prop/slot-driven.** `Base.astro` (head/SEO, header, footer) takes `navLinks`, `palette`, `iconTemplates`, `bodyClass`, and the page metadata props (`title`, `description`, `path`, `ogImage`, `ogType`, `noindex`, `jsonLd`, `split`), plus three named slots: `head` (inject extra head tags), `header` (replace the default `Header`), and `footer` (replace the default `Footer`). Inside those defaults, `Header` has a `logo` slot and `Footer` has a `tagline` slot and a default slot (the link cluster), so a consuming site brings its own nav and branding without editing anything here.
- **The tool renders from config.** `ToolApp` takes a `config` (shaped like `public/config.json`) and a `templates` map, so a consumer can layer extra icons, colors, and categories over the public catalog and the grid, search, and favicons all pick them up. The props accept any catalog, so overriding entries or replacing the color palette outright works too (pass the same set to `Base`'s `palette`); just don't remove icons a published bookmark URL may reference — the favicon invariant depends on them staying resolvable.
- **The lib modules are import-safe.** `bookmarkUrl`, `separatorDrag`, `favicon`, `storage`, and `schema` are the contracts a consumer reuses; some exports have no caller inside this repo because they exist for downstream use (see `CLAUDE.md` → "The downstream seam" before deleting anything that looks dead).

One rule if you build on it: keep the favicon invariant intact (no favicon `href` in static HTML, no re-tinting on a bookmark URL, no redirecting bookmark URLs — see [How it works](#how-it-works)). Everything else is fair game.

## License

This project is licensed under the [MIT License](LICENSE).

**Icon attribution:** the UI glyphs and some of the separator shapes come from [Lucide](https://lucide.dev), a beautiful open source icon library, used and modified under the ISC License. Full text in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).

## Contributing

Diviide is open source, so you're free to use it, adapt it, or contribute to it. This repo is the core of the project: everything it needs to run standalone or as part of something else (that is how [divii.de](https://divii.de) uses it). Issues and pull requests are welcome, whether it's a fix, a new separator icon, or an idea. And if you'd rather build your own thing on top of it, go for it. That's the point.

Before you open a pull request, run the same checks CI runs:

```bash
pnpm run lint && pnpm run lint:copy && pnpm run format:check && pnpm run test:run && pnpm run build
```

`lint:copy` is the one that surprises people: copy here is American English (`color`, not `colour`), including code comments, and rendered copy carries no em dashes. See [CONTRIBUTING.md](CONTRIBUTING.md) for the rest.

## Working with Claude Code

This repo ships config for [Claude Code](https://www.anthropic.com/claude-code) (and any other AI
agent), so an assistant can pick up the conventions without you re-explaining them.

- **`CLAUDE.md`** — the working notes for agents and humans: the commands, the favicon invariant (do
  not weaken), and the gotchas the README's architecture write-up leaves out (chiefly the hardcoded
  counts that must stay in sync).
- **`.claude/skills/`** — step-by-step recipes for the multi-file jobs:
  - **add-icon** — add a new separator/icon (source SVG + config entry + count bumps).
  - **add-category** — add a separator category.
  - **preflight-checks** — run lint, format, test, and build in the right order before committing.

## Credits

**Author:** Sam Wilson

- GitHub: [github.com/samwilsonme](https://github.com/samwilsonme)
- Project: [github.com/samwilsonme/diviide](https://github.com/samwilsonme/diviide)

## Support

Diviide is free and open source, and always will be. If it helps you organize your bookmarks, you can support the work and cover ongoing maintenance:

- [Buy me a coffee](https://buymeacoffee.com/samwilsonme)
- Star the repo on GitHub
- Share it with someone whose bookmarks bar needs it
