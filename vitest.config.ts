/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig runs Vitest with the same resolved Vite config Astro uses, so
// imports in tested modules behave exactly like the app. Tests default to the
// node environment; DOM-touching suites opt in with a `@vitest-environment
// jsdom` pragma at the top of the file.
export default getViteConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // `pnpm run coverage` is a read-it-yourself report, not a gate: no thresholds,
    // so it can never fail a build over a number nobody chose deliberately.
    //
    // The exclusions are the things this project cannot meaningfully cover with
    // Vitest: `.astro` files are markup compiled by Astro (the build and
    // `astro check` are what verify those), and the inline pre-paint bootstrap is
    // a string executed in jsdom by prePaintBootstrap.dom.test.ts rather than an
    // imported module, so it can never register as covered however well it is
    // tested. Config, the test harness and the plain-Node scripts are not app code.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test/**',
        'src/**/*.d.ts',
        'src/content/**',
        'scripts/**',
        '**/*.astro',
      ],
    },
  },
});
