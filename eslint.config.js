import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', '.astro/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Plain-Node scripts; verify-favicons also uses the runtime web globals
    // (fetch, WebSocket, URL) available in the Node 24 runtime this repo
    // targets (see .nvmrc) and sit in the browser set.
    //
    // The root *.mjs glob covers astro.config.mjs and astro.fonts.mjs. Neither
    // reaches for a Node global today, but without this the moment one touches
    // `process` ESLint reports no-undef on correct code. The site's config has
    // carried the same glob since its astro.config.mjs started reading env vars.
    files: ['scripts/**/*.{js,mjs}', '*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  }
);
