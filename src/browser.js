import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Playwright expects a browser build matching its exact version. On machines
 * where Chromium was provisioned separately (CI images, sandboxes, corp
 * builds), that build number will not match and the default launch fails with
 * "Executable doesn't exist". Rather than force a download, find any usable
 * Chromium already on disk and point at it directly.
 *
 * Returns null when Playwright's own managed browser is fine — the normal case
 * after `npx playwright install`.
 */
export function resolveChromiumPath() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }

  // If Playwright's expected binary is present, use it.
  try {
    const expected = chromium.executablePath();
    if (expected && fs.existsSync(expected)) return null;
  } catch {
    // executablePath() throws when nothing is installed; fall through to search.
  }

  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(process.env.HOME || '', '.cache/ms-playwright'),
    '/opt/pw-browsers',
  ].filter((r) => r && fs.existsSync(r));

  const candidates = [];
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!/^chromium/.test(entry)) continue;
      const build = Number(/-(\d+)$/.exec(entry)?.[1] ?? 0);
      // Prefer the full browser: headless_shell cannot do everything chrome can.
      const full = path.join(root, entry, 'chrome-linux', 'chrome');
      const mac = path.join(root, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      const win = path.join(root, entry, 'chrome-win', 'chrome.exe');
      const shell = path.join(root, entry, 'chrome-linux', 'headless_shell');
      for (const [p, rank] of [[full, 2], [mac, 2], [win, 2], [shell, 1]]) {
        if (fs.existsSync(p)) candidates.push({ path: p, rank, build });
      }
    }
  }

  if (!candidates.length) return null;
  // Highest capability, then newest build.
  candidates.sort((a, b) => b.rank - a.rank || b.build - a.build);
  return candidates[0].path;
}

/**
 * Chromium does not read HTTPS_PROXY from the environment the way curl does.
 * Behind a corporate or sandbox proxy, skipping this makes every navigation
 * fail with ERR_CONNECTION_RESET — which, without the guard in analyze(),
 * silently looks like a site with zero accessibility problems.
 */
export function resolveProxy() {
  const server =
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy;
  if (!server) return null;
  const bypass = (process.env.NO_PROXY || process.env.no_proxy || '')
    .split(',').map((s) => s.trim()).filter(Boolean).join(',');
  return bypass ? { server, bypass } : { server };
}

let warned = false;

/** Launch Chromium, transparently handling a version-mismatched local install. */
export async function launchChromium(opts = {}) {
  const executablePath = resolveChromiumPath();
  const proxy = resolveProxy();
  if (!warned && !process.env.A11Y_QUIET_BROWSER) {
    warned = true;
    if (executablePath) console.error(`\x1b[2m  Using system Chromium: ${executablePath}\x1b[0m`);
    if (proxy) console.error(`\x1b[2m  Routing browser traffic via proxy: ${proxy.server}\x1b[0m`);
  }
  return chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...opts,
    ...(executablePath ? { executablePath } : {}),
    ...(proxy ? { proxy } : {}),
  });
}
