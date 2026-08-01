---
name: preflight-checks
description: Use before committing or opening a PR in Diviide. Runs lint, format, tests, and the build, and reports what breaks.
---

# Preflight checks

Run these **in order** and report any failures.

```bash
pnpm run lint        # 1. ESLint
pnpm run format      # 2. Prettier (writes fixes; CI runs format:check, which only verifies)
pnpm run test:run    # 3. Vitest once — includes config-integrity
pnpm run build       # 4. astro check + build — the only full type-check of the .astro components
```

## Notes

- **CI mirrors this** as **lint → format:check → test:run → build** (`.github/workflows/ci.yml`).
  Running `pnpm run format` locally keeps `format:check` green in CI.
- If a count-related test fails, check the hardcoded numbers: the `toHaveLength(…)` assertion in
  `config-integrity.test.ts` and the prose in `README.md`.
- `config-integrity` also checks that every icon in `config.json` has a source SVG in
  `assets/icons/` — there is no generate step; the build bakes the shapes in from those files.
