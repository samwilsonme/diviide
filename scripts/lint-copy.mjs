#!/usr/bin/env node

// The documented copy rules (the workspace CLAUDE.md → Tone of voice, and each
// repo's own Conventions), made mechanical.
//
// This is a LINT, not a test. It used to live in Vitest, in two ~90%-identical
// copies (one per repo), which meant a British spelling in a code comment failed
// the test suite — the wrong feedback channel for a typo, and a second place to
// keep the same word list in sync. The engine lives here and the private site
// imports lintCopy() with its own strings, the same engine/consumer split
// scripts/verify-favicons.mjs already uses.
//
// Run it: `pnpm run lint:copy` (both repos, and in CI next to eslint).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const EM_DASH = '—';

// British spellings that would contradict the identifiers around them
// (DEFAULT_COLOR_HEX, --icon-color, `colorless` in config) and the browsers' own
// American UI strings.
export const BRITISH = [
  'colour',
  'behaviour',
  'honour',
  'favourite',
  'centred',
  'organis',
  'normalis',
  'initialis',
  'rasteris',
  'sanitis',
  'minimis',
  'maximis',
  // Spelled out rather than stemmed to 'emphasis': matching is a plain substring
  // test (see spellCheck below), so the stem would flag the ordinary noun
  // "emphasis". These two cover emphasise/emphasised/emphasises/emphasising.
  'emphasise',
  'emphasising',
  'licence',
];

const CODE_EXTS = ['.astro', '.ts', '.js', '.mjs'];

/**
 * Every source under `dir` with one of `exts`, labelled by its path from `root`.
 *
 * `vendor/` and `node_modules/` are never walked: the submodule is read-only
 * from the site and polices itself with this same sweep in its own repo.
 *
 * Test files and this linter itself are skipped: the rules have to spell the
 * British words out in order to ban them, so a sweep that included its own
 * sources could never pass.
 */
const SELF = /^lint-copy\.mjs$|\.test\.[tj]s$/;

function* sources(dir, exts, root) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vendor' || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path, exts, root);
    else if (exts.some((ext) => entry.name.endsWith(ext)) && !SELF.test(entry.name)) {
      yield [relative(root, path), path];
    }
  }
}

const read = ([label, path]) => [label, readFileSync(path, 'utf8')];

/** Comments removed. They are not copy, and they use dashes freely. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * A British spelling QUOTED in order to ban it is the one legitimate use, so
 * `"colour"` and `` `colour` `` do not count as violations.
 */
const stripQuotedWords = (text) => text.replace(/["`][a-z]+["`]/gi, '');

/**
 * Check one repo's copy. Returns an array of violation strings (empty = clean).
 *
 * @param root      Absolute repo root.
 * @param copy      [label, text] pairs for strings that reach visitors verbatim.
 * @param contentFiles
 *                  Content modules whose string literals are visitor copy, given
 *                  as paths relative to root. Their SOURCE gets the em-dash rule
 *                  (comments stripped), which is how a repo covers content it
 *                  cannot import: the site's faqs.ts and guides.js resolve
 *                  through the `@sep` alias, so plain Node cannot load them.
 *                  Scanning the file is also the wider net — it catches every
 *                  string in there, not just the ones a caller remembered to list.
 * @param docs      Doc paths (relative to root). Missing ones are skipped, so a
 *                  standalone clone without the workspace's shared CLAUDE.md
 *                  still passes. Docs get the SPELLING rule only: the em-dash
 *                  rule is about copy a visitor reads, and docs use dashes freely.
 * @param minPages  Floor on the .astro count, so a broken walk fails loudly
 *                  rather than letting every rule pass vacuously.
 */
export function lintCopy({ root, copy = [], contentFiles = [], docs = [], minPages = 1 }) {
  const violations = [];
  const fail = (label, message) => violations.push(`${label}: ${message}`);

  const srcDir = join(root, 'src');
  // Rendered surfaces: the em-dash rule is about copy a visitor reads.
  const pages = [...sources(srcDir, ['.astro'], root)].map(read);
  // Everything a human writes here, including comments and the build scripts.
  // An .astro-only sweep could not see the spellings that prompted this rule:
  // "colour" and "rasterised" all lived in .ts, .js and .mjs files.
  const authored = [
    ...sources(srcDir, CODE_EXTS, root),
    ...sources(join(root, 'scripts'), CODE_EXTS, root),
  ].map(read);

  if (pages.length < minPages) {
    fail('sweep', `walked only ${pages.length} .astro files, expected at least ${minPages}`);
  }
  if (authored.length <= pages.length) {
    fail('sweep', `walked ${authored.length} authored files, expected more than ${pages.length}`);
  }

  const content = contentFiles
    .map((file) => [file, join(root, file)])
    .filter(([label, path]) => {
      if (existsSync(path)) return true;
      fail(label, 'listed as a content file but does not exist');
      return false;
    })
    .map(read);

  for (const [label, text] of copy) {
    if (text.includes(EM_DASH)) fail(label, 'contains an em dash');
  }
  for (const [label, source] of [...pages, ...content]) {
    if (stripComments(source).includes(EM_DASH)) fail(label, 'contains an em dash in body copy');
  }

  // Comments are deliberately NOT stripped for spelling. The rule reads better as
  // one rule, and exempting comments left the site mixing "colour" into files
  // whose identifiers all say color.
  const spellCheck = (label, text) => {
    const scanned = text.toLowerCase();
    for (const word of BRITISH) {
      if (scanned.includes(word)) fail(label, `contains the British spelling "${word}"`);
    }
  };
  for (const [label, source] of authored) spellCheck(label, source);
  for (const [label, text] of copy) spellCheck(label, text);
  for (const doc of docs) {
    const path = join(root, doc);
    if (!existsSync(path)) continue;
    spellCheck(relative(root, path), stripQuotedWords(readFileSync(path, 'utf8')));
  }

  // The palette is a real selling point, but it is sold through choice ("in any
  // color", "your color") rather than the adjective: Diviide also makes black,
  // white and deliberately muted separators, and the Space Separator has no color
  // at all. Comments are scanned too — describing them that way in a comment is
  // how it ends up in copy later, which is the route package.json's blurb took.
  for (const [label, text] of [...copy, ...authored]) {
    if (text.toLowerCase().includes('colorful')) fail(label, 'describes separators as "colorful"');
  }

  return violations;
}

/** Print violations and exit non-zero if there are any. */
export function report(violations, what) {
  if (violations.length === 0) {
    console.log(`Copy rules pass (${what}).`);
    return;
  }
  console.error(`Copy rule violations (${what}):\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\n${violations.length} violation(s).`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// This repo's own run. The site has its own thin consumer that imports lintCopy.
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { SITE } = await import('../src/content/site.js');
  const { ONBOARDING_STEPS } = await import('../src/content/steps.ts');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  // The brand strings that ship on every page of this repo AND of divii.de, plus
  // the blurb GitHub and npm show. That blurb is why the "colorful" rule exists:
  // it opened with "Colorful separators".
  const copy = [
    ['SITE.name', SITE.name],
    ['SITE.defaultTitle', SITE.defaultTitle],
    ['SITE.defaultDescription', SITE.defaultDescription],
    ['package.json description', pkg.description],
    ...ONBOARDING_STEPS.flatMap((step, i) => [
      [`onboarding step ${i + 1} title`, step.title],
      [`onboarding step ${i + 1} body`, step.body],
    ]),
  ];

  // '../CLAUDE.md' is the workspace-level doc shared with the sibling repos. It
  // declares the American-English rule and was the only file exempt from it,
  // because both old sweeps were scoped to their own repo root. Absent in a
  // standalone clone of this repo, and skipped when it is.
  report(
    lintCopy({ root, copy, docs: ['README.md', 'CLAUDE.md', '../CLAUDE.md'], minPages: 10 }),
    'diviide'
  );
}
