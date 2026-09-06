/**
 * End-to-end verification: serve a knowingly-broken site, scan it, and assert
 * the pipeline reports what a human reviewer would see. Runs entirely on
 * localhost so it needs no outbound network.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { serveFixture } from './serve.js';
import { scanSite } from '../src/scanner.js';
import { analyze, ScanFailedError, computeScore } from '../src/analyze.js';
import { renderReport } from '../src/report.js';
import { htmlFileToPdf } from '../src/pdf.js';
import { parseCsv, slugify, uniqueSlug } from '../src/batch.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`      ${err.message.split('\n')[0]}`);
  }
}

async function main() {
  console.log('\n\x1b[1mAccessibility audit kit — end-to-end tests\x1b[0m\n');

  // ---------- pure units ----------
  console.log('\x1b[1mUnit: CSV parsing\x1b[0m');
  check('parses quoted fields containing commas', () => {
    const rows = parseCsv('url,name\nhttps://a.com,"Acme, Inc."\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Acme, Inc.');
  });
  check('parses escaped quotes', () => {
    const rows = parseCsv('url,name\nhttps://a.com,"The ""Best"" Dentist"\n');
    assert.equal(rows[0].name, 'The "Best" Dentist');
  });
  check('ignores blank lines', () => {
    assert.equal(parseCsv('url,name\n\nhttps://a.com,A\n\n').length, 1);
  });

  console.log('\n\x1b[1mUnit: scoring\x1b[0m');
  check('a clean site scores 100', () => {
    assert.equal(computeScore([], 5), 100);
  });
  check('more defects lower the score', () => {
    const few = computeScore([{ impact: 'serious', instances: 2 }], 5);
    const many = computeScore([{ impact: 'critical', instances: 60 }], 5);
    assert.ok(many < few, `expected ${many} < ${few}`);
  });
  check('score is normalized per page, not absolute', () => {
    const rules = [{ impact: 'serious', instances: 20 }];
    assert.ok(computeScore(rules, 20) > computeScore(rules, 2));
  });
  check('score stays within 1-100', () => {
    const brutal = computeScore(
      Array.from({ length: 40 }, () => ({ impact: 'critical', instances: 200 })), 1
    );
    assert.ok(brutal >= 1 && brutal <= 100, `got ${brutal}`);
  });

  console.log('\n\x1b[1mUnit: output naming\x1b[0m');
  check('slugify strips www and protocol', () => {
    assert.equal(slugify('https://www.Acme-Dental.com/'), 'acme-dental.com');
  });
  check('slugify distinguishes two pages on one host', () => {
    const a = slugify('http://127.0.0.1:8731/');
    const b = slugify('http://127.0.0.1:8731/about.html');
    assert.notEqual(a, b, 'same-host prospects would overwrite each other');
  });
  check('uniqueSlug disambiguates genuine collisions', () => {
    const used = new Set();
    assert.equal(uniqueSlug('acme.com', used), 'acme.com');
    assert.equal(uniqueSlug('acme.com', used), 'acme.com-2');
    assert.equal(uniqueSlug('acme.com', used), 'acme.com-3');
  });

  // ---------- guard against the silent-success failure mode ----------
  console.log('\n\x1b[1mUnit: failed scans must not look clean\x1b[0m');
  check('analyze() throws when no page loaded', () => {
    assert.throws(
      () => analyze({ site: 'https://x.com', pages: [{ url: 'https://x.com', ok: false, error: 'ERR_CONNECTION_RESET' }] }),
      ScanFailedError
    );
  });
  check('analyze() counts only successfully scanned pages', () => {
    const result = analyze({
      site: 'https://x.com',
      standard: 'WCAG 2.1 Level A & AA',
      pages: [
        { url: 'https://x.com/a', ok: true, violations: [], incomplete: [], perf: null, meta: null },
        { url: 'https://x.com/b', ok: false, error: 'timeout', violations: [], incomplete: [] },
      ],
    });
    assert.equal(result.pageCount, 1);
    assert.equal(result.attemptedPageCount, 2);
    assert.equal(result.failedPages.length, 1);
  });

  // ---------- full pipeline against a real browser ----------
  console.log('\n\x1b[1mEnd-to-end: scan → analyze → report → PDF\x1b[0m');
  const fixture = await serveFixture();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-test-'));

  try {
    const scan = await scanSite(fixture.origin, { maxPages: 3 });

    check('crawls beyond the entry page', () => {
      assert.ok(scan.pages.length >= 2, `only scanned ${scan.pages.length}`);
    });
    check('every page loaded successfully', () => {
      const bad = scan.pages.filter((p) => !p.ok);
      assert.equal(bad.length, 0, bad.map((b) => b.error).join('; '));
    });
    check('does not scan the same document twice', () => {
      const fps = scan.pages.map((p) => p.fingerprint).filter(Boolean);
      assert.equal(new Set(fps).size, fps.length, 'duplicate page content was scanned');
    });
    check('spends the crawl budget on distinct pages', () => {
      // "/" and "/index.html" are the same document; the crawler must reach
      // contact.html instead of auditing the homepage twice.
      const paths = scan.pages.map((p) => new URL(p.url).pathname);
      assert.ok(paths.includes('/contact.html'), `scanned: ${paths.join(', ')}`);
    });

    const data = analyze(scan, { hourlyRate: 150 });
    const ruleIds = new Set(data.rules.map((r) => r.id));

    check('detects images with no alt text', () => assert.ok(ruleIds.has('image-alt')));
    check('detects unlabeled form fields', () => assert.ok(ruleIds.has('label')));
    check('detects insufficient colour contrast', () => assert.ok(ruleIds.has('color-contrast')));
    check('detects a missing lang attribute', () => assert.ok(ruleIds.has('html-has-lang')));
    check('detects links with no accessible name', () => assert.ok(ruleIds.has('link-name')));
    check('flags critical or serious issues', () => {
      assert.ok(data.counts.critical + data.counts.serious > 0);
    });
    check('scores a knowingly-broken site poorly', () => {
      assert.ok(data.score < 70, `score was ${data.score}, expected < 70`);
    });
    check('aggregates a rule appearing on several pages', () => {
      const multi = data.rules.find((r) => r.pageCount > 1);
      assert.ok(multi, 'no rule was aggregated across pages');
    });
    check('orders findings by severity', () => {
      const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      const seq = data.rules.map((r) => order[r.impact]);
      assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
    });
    check('produces a non-zero remediation quote', () => {
      assert.ok(data.quote.remediationLow > 0);
      assert.ok(data.quote.remediationHigh > data.quote.remediationLow);
    });
    check('collects performance timings', () => {
      assert.ok(typeof data.perf.avgLoadMs === 'number');
    });

    // ---------- report rendering ----------
    const html = renderReport(data, {
      brand: 'Test Agency',
      contactEmail: 'hello@test.example',
      clientName: 'Bramble & Co',
    });
    const htmlPath = path.join(outDir, 'report.html');
    fs.writeFileSync(htmlPath, html);

    check('report is a complete HTML document', () => {
      assert.ok(html.startsWith('<!doctype html>'));
      assert.ok(html.includes('</html>'));
    });
    check('report contains no external resource references', () => {
      const external = html.match(/(?:src|href)="https?:\/\/[^"]+"/g) || [];
      assert.deepEqual(external, [], `found ${external.slice(0, 3).join(', ')}`);
    });
    check('report escapes client-supplied text', () => {
      assert.ok(html.includes('Bramble &amp; Co'));
      assert.ok(!html.includes('<script>alert'));
    });
    check('report shows the score and grade', () => {
      assert.ok(html.includes(`>${data.score}</div>`));
      assert.ok(html.includes(data.grade.label));
    });
    check('report lists the findings', () => {
      assert.ok(html.includes('Findings, by priority'));
      assert.ok(html.includes(data.rules[0].help));
    });
    check('report includes the quote when enabled', () => {
      assert.ok(html.includes('Estimated remediation investment'));
    });
    check('omits the performance table when nothing meaningful was measured', () => {
      // The fixture is served from localhost, so timings are ~0. A table of
      // zeroes would read as a broken report.
      const empty = renderReport({ ...data, perf: { avgLoadMs: null, avgFcpMs: null, avgLcpMs: null, avgTtfbMs: null, avgRequests: 0, avgTransferredKb: 0 } }, { brand: 'X' });
      assert.ok(!empty.includes('Performance snapshot'));
    });
    check('drops timings that would display as 0.00s', () => {
      const nearZero = renderReport({ ...data, perf: { avgLoadMs: 2, avgFcpMs: 3, avgLcpMs: 1, avgTtfbMs: 1, avgRequests: 0, avgTransferredKb: 0 } }, { brand: 'X' });
      assert.ok(!nearZero.includes('0.00s'));
      assert.ok(!nearZero.includes('Performance snapshot'));
    });
    check('shows the performance table when real numbers exist', () => {
      const full = renderReport({ ...data, perf: { avgLoadMs: 2400, avgFcpMs: 1100, avgLcpMs: 2100, avgTtfbMs: 300, avgRequests: 48, avgTransferredKb: 1800 } }, { brand: 'X' });
      assert.ok(full.includes('Performance snapshot'));
      assert.ok(full.includes('2.40s'));
    });
    check('a clean site is never quoted for remediation', () => {
      const clean = renderReport({ ...data, ruleCount: 0, rules: [], quickWins: [] }, { brand: 'X' });
      assert.ok(!clean.includes('Estimated remediation investment'));
    });
    check('--no-quote omits pricing entirely', () => {
      const noQuote = renderReport(data, { brand: 'X', showQuote: false });
      assert.ok(!noQuote.includes('Estimated remediation investment'));
      assert.ok(!noQuote.includes('remediation investment'));
    });

    const pdfPath = path.join(outDir, 'report.pdf');
    await htmlFileToPdf(htmlPath, pdfPath, { brand: 'Test Agency' });
    check('renders a valid, non-trivial PDF', () => {
      const buf = fs.readFileSync(pdfPath);
      assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
      assert.ok(buf.length > 20000, `pdf was only ${buf.length} bytes`);
    });

    console.log(`\n  \x1b[2mfixture score: ${data.score}/100 (${data.grade.letter}) · ` +
      `${data.ruleCount} issue types · ${data.totalInstances} failures · ` +
      `quote $${data.quote.remediationLow}–$${data.quote.remediationHigh}\x1b[0m`);
  } finally {
    await fixture.close();
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  console.log(`\n\x1b[1mResult:\x1b[0m ${passed} passed, ${failed} failed\n`);
  if (failed) {
    for (const f of failures) console.log(`\x1b[31m${f.name}\x1b[0m\n${f.err.stack}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\x1b[31mTest run crashed:\x1b[0m', err);
  process.exit(1);
});
