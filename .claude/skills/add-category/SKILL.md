---
name: add-category
description: Use when adding a new separator category to Diviide. Covers the config.json categories entry, assigning icons to it, and the README count.
---

# Add a new category

Categories are config-driven. The category filter UI is derived from `config.json`, so adding one
is mostly a config edit plus reassigning icons.

## Steps

### 1. Add the category to `public/config.json`

Add a `"key": "Label"` pair to the `categories` object (key is lowercase, used internally; the
value is the displayed label):

```json
"categories": {
  "all": "All",
  "separators": "Separators",
  "your-category": "Your Category"
}
```

### 2. Assign icons to it

Set `"category": "your-category"` on the relevant icon entries under `"icons"`. A category with no
icons renders an **empty tab** — assign at least one, or don't add the category yet.

### 3. Update the README count (if the displayed total changes)

`README.md` hardcodes the category count and list in prose (the "N categories — Shapes, Arrows, …"
Features bullet). Find it with `grep -n "categories" README.md` and update the number and the list.
(Note "all" is a meta-filter, not counted in that prose number.)

### 4. Verify

```bash
pnpm run test:run   # config-integrity asserts every icon's category exists
pnpm run dev        # the new tab appears and filters correctly
```
