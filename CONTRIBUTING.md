# Contributing to Diviide

Thanks for taking a look. Issues and pull requests are welcome, whether it's a fix, a new
separator icon, or an idea. If you'd rather build your own thing on top of this, go for that
instead. That's the point of it being open source.

## Getting set up

Node 24 (see `.nvmrc`) and pnpm, which is pinned in the `packageManager` field.

```bash
pnpm install
pnpm run dev        # http://localhost:4321
```

The root opens straight into the tool, so there's nothing else to wire up.

## Before you open a pull request

Run the same checks CI runs, in this order:

```bash
pnpm run lint && pnpm run lint:copy && pnpm run format:check && pnpm run test:run && pnpm run build
```

`pnpm run build` is `astro check && astro build`, so it's the type gate as well as the build.
There's a skill at `.claude/skills/preflight-checks/` that walks the same sequence.

## Three things that trip people up

### 1. The favicon invariant

This is the whole reason the project exists, and it's the one thing a pull request cannot break.
Browsers key a bookmark's favicon to the exact URL it was saved on, including the query string, so:

1. Static HTML must never carry a favicon `href`. The pre-paint bootstrap
   (`src/components/PrePaintBootstrap.astro`) owns the `<link id="diviide-favicon">`.
2. Never re-tint the live favicon while the page is sitting on a bookmark URL
   (`/separators/?icon=…&color=…`). See the guard in `applyColor()` and the parking logic in
   `src/lib/favicon.ts`. It was tuned against real browser behavior, so port it rather than
   redesigning it.
3. Never redirect a bookmark URL. The redirect target's favicon overwrites the saved one.

`src/lib/favicon.test.ts` and `src/lib/bookmarkUrl.test.ts` are the executable spec. If you touch
anything in this area, also run the real-Chrome check:

```bash
pnpm run build && pnpm run test:favicons
```

It's headed and takes about ten seconds per flow.

### 2. The copy rules (`lint:copy`)

Copy here is American English, including code comments, and rendered copy carries no em dashes.
`scripts/lint-copy.mjs` enforces both across `src/` and `scripts/`, plus the READMEs. It's a
separate CI step from ESLint, so a British spelling in a comment fails the build. Write `color`,
not `colour`.

### 3. Counts that don't auto-update

The catalog lives in one file, `public/config.json`. Adding an icon, color or category means
updating things that are deliberately hardcoded:

- `src/test/config-integrity.test.ts` asserts the exact icon count.
- README prose hardcodes the icon, color, combination and category counts.
- `package.json`'s `description` hardcodes the icon count too, and the integrity test pins it.
- Every icon in `config.json` needs a matching source SVG in `assets/icons/`.

The `.claude/skills/add-icon/` and `add-category/` skills list every file to touch.

## Exports that look unused but aren't

This repo is built to be consumed as a read-only submodule by other projects, so a number of
exports have no caller inside this checkout. They are public API, not dead code.
`CLAUDE.md` → "The downstream seam" lists every one. Please don't remove them in a cleanup pass.

## Adding a separator icon

Source SVGs are 24x24, `viewBox="0 0 24 24"`, `fill="none"`, with every stroke and fill literally
`"black"`. The favicon swaps those for the live color and the CSS mask uses only the shape's
alpha, so any other color breaks the tint. Follow `.claude/skills/add-icon/SKILL.md` and the
existing files in `assets/icons/`.

## Reporting a security issue

Please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Code of conduct

Be decent to people. Harassment, personal attacks and bad-faith argument aren't welcome, and I'll
close or block on them. If someone's behavior is a problem, email hello@divii.de.
