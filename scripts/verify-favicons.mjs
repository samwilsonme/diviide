#!/usr/bin/env node

// End-to-end verification of the favicon guarantee against REAL Chrome — the
// one behavior unit tests cannot reach. For each flow it serves the built
// dist/, drives Chrome (throwaway profile, CDP over Node's built-in WebSocket)
// through the user journey — arrive, drag a separator (the real delegated
// dragstart handler runs: URL parking + favicon set), switch color (restore +
// re-tint) — then closes Chrome and asserts the page→icon mappings in its
// Favicons SQLite database:
//
//   1. the dragged bookmark URL still maps to ITS OWN icon (frozen), and
//   2. the live page URL maps to the re-tinted default icon.
//
// This is exactly the check that caught the client-redirect bleed (see
// src/pages/index.astro): Chrome attributes favicon updates from a
// client-redirected document to every same-document URL, which overwrote
// freshly dragged bookmarks. Keep this green.
//
// Requirements: a prior `pnpm run build`, Google Chrome, and the sqlite3 CLI
// (preinstalled on macOS and GitHub's ubuntu runners). Chrome runs HEADED for
// ~10s per flow — the favicon service behavior is what's under test, and
// headed is the verified environment. Override the binary with CHROME=<path>.
//
// The default export runs this repo's flows; the private site imports
// verifyFaviconFlows() with its own (see its scripts/verify-favicons.mjs).

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, rmSync, mkdtempSync } from 'node:fs';
import { join, extname, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
// The app's own favicon primitives, so the expected data URI is built by exactly
// the code the app runs. Both modules are import-free by design precisely so this
// plain-Node script can load them under Node's type stripping — see the rule at
// the top of src/lib/faviconPaint.ts (pinned by faviconPaint.test.ts).
import { normalizeHex, faviconSvg, roundIconSvg } from '../src/lib/faviconPaint.ts';
import { svgDataUri } from '../src/lib/svgDataUri.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Static file server (dependency-free). Mirrors real static hosts: directory
// requests without a trailing slash get a 301 (verified safe for favicons —
// only CLIENT redirects bleed).
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
};

function serveDist(distDir) {
  // Normalized once: the confinement check below compares path prefixes, and the
  // consuming site passes its own dist path (see its scripts/verify-favicons.mjs).
  const root = resolve(distDir);
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Resolve and confine to the served root. The URL parser normalizes dot
    // segments, including percent-encoded ones (`/%2e%2e/`), but it cannot
    // normalize what it does not see as a separator: encode the SLASHES too and
    // `/%2e%2e%2f%2e%2e%2fpackage.json` arrives as one opaque segment, which
    // decodeURIComponent below then turns into `../../package.json`. Only a test
    // server on 127.0.0.1, but the fix is three lines.
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('forbidden');
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${pathname}/` });
        return res.end();
      }
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  // Not named `resolve` — that is path.resolve above, used by the handler.
  return new Promise((ready) => {
    server.listen(0, '127.0.0.1', () => ready(server));
  });
}

// ---------------------------------------------------------------------------
// Minimal CDP client over the built-in WebSocket.
// ---------------------------------------------------------------------------

function chromeBinary() {
  if (process.env.CHROME) return process.env.CHROME;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return 'google-chrome';
}

// Every wait on Chrome is bounded: a hung browser must fail the run loudly,
// not park it forever (CI would otherwise sit until the job timeout).
const CDP_TIMEOUT_MS = 15_000;

function withTimeout(promise, what, ms = CDP_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms: ${what}`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

let msgId = 0;
function cdp(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      reject(new Error(`CDP ${method}: no reply after ${CDP_TIMEOUT_MS}ms`));
    }, CDP_TIMEOUT_MS);
    const onMessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function launchChrome(profileDir) {
  const chrome = spawn(
    chromeBinary(),
    [
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // A missing/broken binary surfaces as an async 'error' event; without a
  // listener that crashes the process with nothing cleaned up.
  let spawnError = null;
  chrome.on('error', (err) => {
    spawnError = err;
  });

  // Everything between spawn and a usable session can fail or hang (bad
  // binary, startup crash, hung DevTools endpoint); on any of it, kill the
  // headed Chrome instead of leaving it on the user's screen.
  let ws;
  let sessionId;
  try {
    // Chrome writes the ephemeral debugging port to DevToolsActivePort.
    const portFile = join(profileDir, 'DevToolsActivePort');
    let port;
    for (let i = 0; i < 80 && !port; i++) {
      if (spawnError) throw new Error(`could not launch Chrome: ${spawnError.message}`);
      try {
        port = Number(readFileSync(portFile, 'utf-8').split('\n')[0]);
      } catch {
        await sleep(250);
      }
    }
    if (!port) throw new Error('Chrome did not expose a DevTools port');

    const version = await withTimeout(
      fetch(`http://127.0.0.1:${port}/json/version`).then((res) => res.json()),
      'DevTools /json/version'
    );
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await withTimeout(
      new Promise((r) => ws.addEventListener('open', r, { once: true })),
      'DevTools socket open'
    );

    const { targetInfos } = await cdp(ws, 'Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    ({ sessionId } = await cdp(ws, 'Target.attachToTarget', {
      targetId: page.targetId,
      flatten: true,
    }));
  } catch (err) {
    chrome.kill();
    throw err;
  }

  return {
    chrome,
    ws,
    evaluate: async (expression) => {
      const { result, exceptionDetails } = await cdp(
        ws,
        'Runtime.evaluate',
        { expression, returnByValue: true },
        sessionId
      );
      if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
      return result.value;
    },
    navigate: (url) => cdp(ws, 'Page.navigate', { url }, sessionId),
    close: async () => {
      // A graceful quit lets Chrome flush the Favicons DB; if the browser is
      // hung, fall back to killing it so the run can finish (and fail) cleanly.
      try {
        await cdp(ws, 'Browser.close');
        await withTimeout(new Promise((r) => chrome.on('exit', r)), 'Chrome exit');
      } catch (err) {
        chrome.kill();
        throw err;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The flow runner + Favicons DB assertions.
// ---------------------------------------------------------------------------

function faviconMappings(profileDir) {
  const db = join(profileDir, 'Default', 'Favicons');
  const out = execFileSync(
    'sqlite3',
    [db, 'SELECT im.page_url, f.url FROM icon_mapping im JOIN favicons f ON f.id = im.icon_id;'],
    { encoding: 'utf-8' }
  );
  return new Map(
    out
      .trim()
      .split('\n')
      .filter(Boolean)
      // page_url may itself contain '|' only via encoding; the favicon URL is the
      // remainder after the first separator (data URIs contain no raw '|').
      .map((line) => {
        const i = line.indexOf('|');
        return [line.slice(0, i), line.slice(i + 1)];
      })
  );
}

// Rebuild the favicon a page should map to. The favicon is generated on the fly
// (no per-color file): the same source template + resolved hex + encoding the app
// uses (window.__diviideIconTemplates / faviconDataUri in favicon.ts), so
// Chrome's stored favicon URL is this exact data: URI. The three steps come from
// the app's own modules rather than being reimplemented here — this file used to
// carry its own copies of the hex regex, the paint replacement and the coordinate
// rounding, pinned to the originals only by source-text assertions.
function iconTemplate(iconsDirs, icon) {
  for (const dir of iconsDirs) {
    const p = join(dir, `${icon}.svg`);
    if (!existsSync(p)) continue;
    return roundIconSvg(readFileSync(p, 'utf-8'));
  }
  throw new Error(`no source SVG for icon "${icon}"`);
}

function faviconDataUri(iconsDirs, icon, token) {
  return svgDataUri(faviconSvg(iconTemplate(iconsDirs, icon), normalizeHex(token)));
}

/**
 * Run drag-capture flows against a built site and assert Chrome's favicon
 * mappings. Each flow:
 *   { name, startPath, dragSelector, swatchSelector,
 *     draggedIcon, draggedColor, switchColor, defaultIcon }
 * Asserts, after drag + color switch + graceful quit:
 *   /separators/?icon={draggedIcon}&color={draggedColor} -> its own icon (frozen)
 *   {startPath}                                          -> {defaultIcon}/{switchColor}
 */
export async function verifyFaviconFlows({
  distDir,
  flows,
  coldChecks = [],
  iconsDirs = [join(__dirname, '..', 'assets', 'icons')],
}) {
  const server = await serveDist(distDir);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const failures = [];

  try {
    // Cold-load checks: arrive directly at a bookmark URL (as opening a saved
    // bookmark does) and assert its favicon is frozen from the query — including
    // an arbitrary hex not in the palette, the new on-the-fly capability.
    for (const check of coldChecks) {
      const profileDir = mkdtempSync(join(tmpdir(), 'diviide-favicons-'));
      // The profile dir outlives the browser (the DB is read after quit), so
      // remove it in a finally: a failed launch or hung CDP call must not
      // leak throwaway profiles into the temp dir.
      try {
        const pagePath = `/separators/?icon=${check.icon}&color=${check.color}`;
        console.log(`\n── ${check.name} (${origin}${pagePath})`);
        const browser = await launchChrome(profileDir);
        try {
          await browser.navigate(`${origin}${pagePath}`);
          await sleep(4000); // load + let the favicon service capture
        } finally {
          await browser.close();
        }
        const mappings = faviconMappings(profileDir);
        const pageUrl = `${origin}${pagePath}`;
        const expected = faviconDataUri(iconsDirs, check.icon, check.color);
        const actual = mappings.get(pageUrl);
        const ok = actual === expected;
        console.log(`   ${ok ? 'PASS' : 'FAIL'}  favicon frozen from the query`);
        if (!ok) {
          console.log(`         page:     ${pageUrl}`);
          console.log(`         expected: ${expected.slice(0, 120)}…`);
          console.log(`         actual:   ${(actual ?? '(no mapping)').slice(0, 120)}…`);
          failures.push(`${check.name}: favicon frozen from the query`);
        }
      } finally {
        rmSync(profileDir, { recursive: true, force: true });
      }
    }

    for (const flow of flows) {
      const profileDir = mkdtempSync(join(tmpdir(), 'diviide-favicons-'));
      try {
        console.log(`\n── ${flow.name} (${origin}${flow.startPath})`);
        const browser = await launchChrome(profileDir);

        try {
          await browser.navigate(`${origin}${flow.startPath}`);
          await sleep(3000); // page load + tool init

          const afterDrag = await browser.evaluate(`(() => {
            const tile = document.querySelector('${flow.dragSelector}');
            if (!tile) return 'NO TILE for ${flow.dragSelector}';
            tile.dispatchEvent(new DragEvent('dragstart', {
              bubbles: true, cancelable: true, dataTransfer: new DataTransfer(),
            }));
            return location.pathname + location.search;
          })()`);
          console.log(`   after drag:   ${afterDrag}`);
          await sleep(2500); // capture window (the page stays parked on purpose)

          const afterSwitch = await browser.evaluate(`(() => {
            const b = document.querySelector('${flow.swatchSelector}');
            if (!b) return 'NO SWATCH for ${flow.swatchSelector}';
            b.click();
            return location.pathname + location.search;
          })()`);
          console.log(`   after switch: ${afterSwitch}`);
          await sleep(4000); // let the favicon service settle before quitting
        } finally {
          await browser.close();
        }

        const mappings = faviconMappings(profileDir);
        const checks = [
          {
            what: 'dragged bookmark stays frozen',
            pageUrl: `${origin}/separators/?icon=${flow.draggedIcon}&color=${flow.draggedColor}`,
            expected: faviconDataUri(iconsDirs, flow.draggedIcon, flow.draggedColor),
          },
          {
            what: 'live page re-tints to the switched color',
            pageUrl: `${origin}${flow.startPath}`,
            expected: faviconDataUri(iconsDirs, flow.defaultIcon, flow.switchColor),
          },
        ];
        for (const check of checks) {
          const actual = mappings.get(check.pageUrl);
          const ok = actual === check.expected;
          console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${check.what}`);
          if (!ok) {
            console.log(`         page:     ${check.pageUrl}`);
            console.log(`         expected: ${check.expected.slice(0, 120)}…`);
            console.log(`         actual:   ${(actual ?? '(no mapping)').slice(0, 120)}…`);
            failures.push(`${flow.name}: ${check.what}`);
          }
        }
      } finally {
        rmSync(profileDir, { recursive: true, force: true });
      }
    }
  } finally {
    server.close();
  }

  console.log(
    failures.length === 0
      ? '\nAll favicon flows passed.'
      : `\n${failures.length} favicon check(s) FAILED:\n  - ${failures.join('\n  - ')}`
  );
  return failures.length === 0;
}

// The tool's own flows: the same journey from both routes that serve the tool.
// Color travels as a bare hex now: the dragged color is the fresh-profile
// default (teal), the switched color is green; swatches are keyed by data-hex.
export function toolFlows({ startPaths = ['/', '/separators/'] } = {}) {
  return startPaths.map((startPath) => ({
    name: `tool grid drag, arriving at ${startPath}`,
    startPath,
    dragSelector: 'a[data-tile][data-icon="pipe-small"]',
    swatchSelector: 'button[data-swatch][data-hex="#22c55e"]',
    draggedIcon: 'pipe-small',
    draggedColor: '14b8a6',
    switchColor: '22c55e',
    defaultIcon: 'lines-vertical-small',
  }));
}

// Run this repo's flows when executed directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const distDir = join(__dirname, '..', 'dist');
  if (!existsSync(join(distDir, 'index.html'))) {
    console.error('dist/ not found — run `pnpm run build` first.');
    process.exit(1);
  }
  const ok = await verifyFaviconFlows({
    distDir,
    flows: toolFlows(),
    coldChecks: [
      // A hex not in the palette, generated on the fly and frozen into the
      // bookmark — proof the color-wheel model persists with no stored file.
      { name: 'arbitrary-hex bookmark cold load', icon: 'pipe-small', color: 'e11d48' },
      // An icon whose source SVG carries 3+-decimal coordinates — proof the
      // oracle applies the same rounding the app's template pipeline does
      // (pipe-small has integer coordinates and would never catch drift there).
      { name: 'rounded-coordinate icon cold load', icon: '0-small', color: 'e11d48' },
    ],
  });
  process.exit(ok ? 0 : 1);
}
