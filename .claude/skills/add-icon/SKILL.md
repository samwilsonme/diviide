---
name: add-icon
description: Use when adding a new separator/icon to Diviide. Covers the source SVG, the config.json entry, and the count bumps in the integrity test and README.
---

# Add a new icon (separator)

Icons are **config-driven**. You hand-write one black template SVG and a config entry; the build
bakes the shape into the HTML as a data-URI mask (`src/lib/iconTemplates.ts` globs `assets/icons/`,
so new files are picked up automatically). Adding one icon touches **four** places — two of them
(a test assertion and README prose) are hardcoded and will break if skipped.

## Steps

### 1. Create the source SVG

`assets/icons/{kebab-name}.svg` — 24×24, `viewBox="0 0 24 24"`, `fill="none"`, and **all strokes
and fills literally `"black"`** (the favicon regex-swaps `stroke="black"` / `fill="black"` to the
live hex — see `faviconSvg` in `src/lib/favicon.ts`; the mask uses only the shape's alpha). No
other colors.

```xml
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 19L12 5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### 2. Register it in `public/config.json`

Add an entry under `"icons"`:

```json
"your-icon-name": {
  "name": "Your Icon Name",
  "category": "separators",
  "keywords": ["pipe", "vertical", "line", "separator"]
}
```

- `category` **must** be an existing key in the `categories` object (else `config-integrity` fails).
- `keywords` lowercase; these power search.
- `"colorless": true` only for blank/space-like icons. It changes the combination math: a colorless
  icon adds 1 combination instead of one-per-color.

### 3. Bump the icon count in the integrity test

`src/test/config-integrity.test.ts` — update `expect(Object.keys(config.icons)).toHaveLength(182)`
to the new total. **This test fails otherwise.**

### 4. Update README and package.json prose counts

`README.md` and the `package.json` `description` hardcode the separator count in prose. Run
`grep -n 182 README.md package.json`
and update **every present-tense count** (headline, Features, Architecture, Styling, the
`package.json` description — `config-integrity` pins that one) — but leave
the measurement table in the "Icon delivery" section (`183 requests / 182 SVGs`) alone: it records
a historical measurement and must not change. The color and
combination labels come from `src/lib/separatorCounts.ts`:
`combinations = 16,777,216 × (icons − colorless) + colorless`, truncated to a label like
`3 billion+` — only update those labels if the magnitude actually changes.

### 5. Verify

```bash
pnpm run test:run   # config-integrity passes (category exists, SVG exists, count matches)
pnpm run dev        # eyeball the new icon in the grid
```

## Key files

| Purpose                                | Path                                             |
| -------------------------------------- | ------------------------------------------------ |
| Source SVG template                    | `assets/icons/{name}.svg`                        |
| Config registry (source of truth)      | `public/config.json`                             |
| Template loader (build-time glob)      | `src/lib/iconTemplates.ts`                       |
| Count formula                          | `src/lib/separatorCounts.ts`                     |
| Integrity test (hardcoded count)       | `src/test/config-integrity.test.ts`              |
| Runtime rendering (uses the icon mask) | the `separator` utility (`src/styles/theme.css`) |
