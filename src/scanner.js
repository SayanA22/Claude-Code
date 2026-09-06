import { createHash } from 'node:crypto';
import { launchChromium } from './browser.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');
const AXE_SOURCE = require('node:fs').readFileSync(AXE_PATH, 'utf8');

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/** Normalize a URL for dedupe: drop hash, trailing slash, and common tracking params. */
function normalize(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(p)) u.searchParams.delete(p);
    }
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

/** Skip links that are not crawlable HTML pages. */
function isCrawlable(url, origin) {
  if (!url) return false;
  if (!url.startsWith(origin)) return false;
  if (/\.(pdf|jpe?g|png|gif|svg|webp|avif|zip|gz|mp4|mp3|webm|docx?|xlsx?|pptx?|csv|ico|css|js|json|xml|rss)(\?|$)/i.test(url)) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(url)) return false;
  return true;
}

/**
 * Collect paint/layout timings from the page. These are field-free lab numbers —
 * good enough to show a prospect that speed is costing them, not a Lighthouse
 * replacement.
 */
async function collectPerf(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1] : null;
    const resources = performance.getEntriesByType('resource');
    const transferred = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    return {
      ttfbMs: nav ? Math.round(nav.responseStart) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
      firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
      largestContentfulPaintMs: lcp ? Math.round(lcp.startTime) : null,
      requestCount: resources.length,
      transferredBytes: transferred,
    };
  });
}

/** Page-level signals a business owner understands even when axe finds little. */
async function collectPageMeta(page) {
  return page.evaluate(() => {
    const imgs = [...document.images];
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(
      (el) => !['hidden', 'submit', 'button', 'image', 'reset'].includes(el.type)
    );
    const unlabeled = inputs.filter((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
      return !el.closest('label');
    });
    const h1s = document.querySelectorAll('h1');
    return {
      title: document.title || null,
      lang: document.documentElement.getAttribute('lang') || null,
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      metaDescription: document.querySelector('meta[name="description"]')?.content || null,
      imageCount: imgs.length,
      imagesMissingAlt: imgs.filter((i) => !i.hasAttribute('alt')).length,
      formFieldCount: inputs.length,
      unlabeledFormFields: unlabeled.length,
      h1Count: h1s.length,
      linkCount: document.links.length,
      hasSkipLink: [...document.links].slice(0, 5).some((a) => /skip|main content/i.test(a.textContent || '')),
    };
  });
}

/**
 * Fingerprint the rendered page so `/`, `/index.html` and `/?utm_source=x`
 * are recognised as the same document. Without this a crawl budget gets spent
 * auditing one page several times and real pages are never reached.
 */
async function pageFingerprint(page) {
  const raw = await page.evaluate(() => {
    const body = document.body;
    if (!body) return document.title || '';
    // Structure + visible text, ignoring attributes that vary per request.
    const structure = [...body.querySelectorAll('*')]
      .slice(0, 400)
      .map((el) => el.tagName)
      .join('');
    const text = (body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
    return `${document.title}|${structure}|${text}`;
  });
  return createHash('sha1').update(raw).digest('hex');
}

async function auditOnePage(page, url, tags) {
  const started = Date.now();
  const result = {
    url,
    ok: false,
    httpStatus: null,
    error: null,
    finalUrl: null,
    fingerprint: null,
    violations: [],
    incomplete: [],
    passCount: 0,
    perf: null,
    meta: null,
    elapsedMs: 0,
  };

  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    result.httpStatus = response ? response.status() : null;
    result.finalUrl = normalize(page.url()) || url;

    // Let lazy content and late-loading widgets settle before scanning.
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));

    result.perf = await collectPerf(page);
    result.meta = await collectPageMeta(page);
    result.fingerprint = await pageFingerprint(page);

    await page.evaluate(AXE_SOURCE);
    const axeResult = await page.evaluate(
      async (runTags) =>
        await window.axe.run(document, {
          runOnly: { type: 'tag', values: runTags },
          resultTypes: ['violations', 'incomplete'],
        }),
      tags
    );

    result.violations = axeResult.violations.map((v) => ({
      id: v.id,
      impact: v.impact || 'minor',
      help: v.help,
      description: v.description,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodeCount: v.nodes.length,
      samples: v.nodes.slice(0, 4).map((n) => ({
        target: Array.isArray(n.target) ? n.target.join(' ') : String(n.target),
        html: (n.html || '').slice(0, 400),
        summary: (n.failureSummary || '').slice(0, 600),
      })),
    }));
    result.incomplete = axeResult.incomplete.map((v) => ({
      id: v.id,
      impact: v.impact || 'minor',
      help: v.help,
      nodeCount: v.nodes.length,
    }));
    result.passCount = Array.isArray(axeResult.passes) ? axeResult.passes.length : 0;
    result.ok = true;
  } catch (err) {
    result.error = err.message;
  }

  result.elapsedMs = Date.now() - started;
  return result;
}

/** Pull same-origin links so we can pick the next pages to audit. */
async function extractLinks(page, origin) {
  const hrefs = await page.evaluate(() => [...document.links].map((a) => a.href));
  const out = new Set();
  for (const href of hrefs) {
    const n = normalize(href);
    if (isCrawlable(n, origin)) out.add(n);
  }
  return [...out];
}

/**
 * Crawl and audit a site.
 * @param {string} startUrl
 * @param {{maxPages?: number, tags?: string[], viewport?: {width:number,height:number}, onProgress?: Function}} opts
 */
export async function scanSite(startUrl, opts = {}) {
  const maxPages = opts.maxPages ?? 8;
  const tags = opts.tags ?? DEFAULT_TAGS;
  const viewport = opts.viewport ?? { width: 1366, height: 900 };
  const onProgress = opts.onProgress ?? (() => {});

  const start = normalize(startUrl.startsWith('http') ? startUrl : `https://${startUrl}`);
  if (!start) throw new Error(`Invalid URL: ${startUrl}`);
  const origin = new URL(start).origin;

  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 a11y-audit-kit/1.0',
    ignoreHTTPSErrors: true,
  });

  const queue = [start];
  const seen = new Set([start]);
  const fingerprints = new Set();
  const pages = [];
  let duplicatesSkipped = 0;

  try {
    const page = await context.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    while (queue.length && pages.length < maxPages) {
      const url = queue.shift();
      onProgress({ phase: 'scanning', url, done: pages.length, total: maxPages });
      const res = await auditOnePage(page, url, tags);

      // Same document under a different URL — do not spend budget on it twice.
      const isDuplicate = res.ok && res.fingerprint && fingerprints.has(res.fingerprint);
      if (isDuplicate) {
        duplicatesSkipped++;
      } else {
        if (res.fingerprint) fingerprints.add(res.fingerprint);
        if (res.finalUrl) seen.add(res.finalUrl);
        pages.push(res);
      }

      if (res.ok && pages.length < maxPages) {
        let links = [];
        try {
          links = await extractLinks(page, origin);
        } catch {
          links = [];
        }
        // Prefer shallow, distinct sections — they are what a prospect actually looks at.
        links.sort((a, b) => new URL(a).pathname.split('/').length - new URL(b).pathname.split('/').length);
        for (const link of links) {
          if (!seen.has(link) && queue.length + pages.length < maxPages * 3) {
            seen.add(link);
            queue.push(link);
          }
        }
      }
    }
    await page.close();
  } finally {
    await context.close();
    await browser.close();
  }

  return {
    site: origin,
    startUrl: start,
    scannedAt: new Date().toISOString(),
    standard: 'WCAG 2.1 Level A & AA',
    pageCount: pages.length,
    duplicatesSkipped,
    pages,
  };
}

export { normalize, isCrawlable };
