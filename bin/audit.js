#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { scanSite } from '../src/scanner.js';
import { analyze } from '../src/analyze.js';
import { renderReport } from '../src/report.js';
import { htmlFileToPdf } from '../src/pdf.js';
import { readProspects, slugify, uniqueSlug, appendSummaryRow } from '../src/batch.js';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key.startsWith('no-')) { args[key.slice(3)] = false; continue; }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

const HELP = `
${C.bold('a11y-audit')} — automated accessibility audits that produce sellable reports

${C.bold('USAGE')}
  node bin/audit.js scan <url> [options]
  node bin/audit.js batch <prospects.csv> [options]

${C.bold('OPTIONS')}
  --brand <name>       Your business name on the report      (default: "Accessibility Audit")
  --name <name>        Your name in the report footer
  --email <email>      Your contact email
  --phone <phone>      Your contact phone
  --pages <n>          Max pages to scan per site            (default: 8)
  --rate <n>           Your hourly rate, drives the quote    (default: 150)
  --out <dir>          Output directory                      (default: ./reports)
  --no-quote           Omit pricing (use for free samples that lead to a call)
  --no-pdf             Skip PDF generation, HTML only
  --limit <n>          batch: stop after N prospects
  --concurrency <n>    batch: sites in parallel              (default: 2)

${C.bold('EXAMPLES')}
  ${C.dim('# One audit, fully branded, with a quote')}
  node bin/audit.js scan https://example.com --brand "Northside Digital" \\
    --email you@example.com --rate 175

  ${C.dim('# 50 free sample reports for outreach — no pricing, ends in a call')}
  node bin/audit.js batch prospects.csv --brand "Northside Digital" --no-quote --pages 5

${C.bold('CSV FORMAT')} (header required; url is the only mandatory column)
  url,name,contact,email
  https://acmedental.com,Acme Dental,Dr. Rivera,front@acmedental.com
`;

async function runOne(target, opts, usedSlugs = new Set()) {
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  // Claim the output name before the scan starts, so concurrent workers in a
  // batch cannot both decide on the same filename.
  const slug = uniqueSlug(slugify(target.url), usedSlugs);

  const scan = await scanSite(target.url, {
    maxPages: Number(opts.pages) || 8,
    onProgress: opts.quiet
      ? () => {}
      : ({ url, done, total }) =>
          process.stdout.write(`\r  ${C.dim(`[${done + 1}/${total}]`)} ${url.slice(0, 68).padEnd(68)}`),
  });
  if (!opts.quiet) process.stdout.write('\r' + ' '.repeat(90) + '\r');

  const data = analyze(scan, { hourlyRate: Number(opts.rate) || 150 });

  const html = renderReport(data, {
    brand: opts.brand,
    contactName: opts.name,
    contactEmail: opts.email,
    contactPhone: opts.phone,
    clientName: target.name || undefined,
    showQuote: opts.quote !== false,
  });

  const htmlPath = path.join(outDir, `${slug}-accessibility-audit.html`);
  const jsonPath = path.join(outDir, `${slug}-data.json`);
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  let pdfPath = null;
  if (opts.pdf !== false) {
    pdfPath = path.join(outDir, `${slug}-accessibility-audit.pdf`);
    await htmlFileToPdf(htmlPath, pdfPath, { brand: opts.brand });
  }

  return { data, htmlPath, pdfPath, jsonPath, slug };
}

function printSummary(target, r) {
  const d = r.data;
  const toneColor = d.grade.tone === 'good' ? C.green : d.grade.tone === 'bad' ? C.red : C.yellow;
  console.log('');
  console.log(`  ${C.bold(d.site)}`);
  console.log(`  Score        ${toneColor(C.bold(String(d.score)))}/100  ${toneColor(`${d.grade.letter} — ${d.grade.label}`)}`);
  console.log(`  Issues       ${C.red(String(d.counts.critical))} critical · ${C.yellow(String(d.counts.serious))} serious · ${d.counts.moderate} moderate · ${d.counts.minor} minor`);
  console.log(`  Failures     ${d.totalInstances.toLocaleString()} across ${d.pageCount} page(s)`);
  console.log(`  Quote        $${d.quote.remediationLow.toLocaleString()} – $${d.quote.remediationHigh.toLocaleString()}  ${C.dim(`(~${d.quote.remediationHours}h)`)}`);
  console.log(`  Report       ${C.cyan(r.pdfPath || r.htmlPath)}`);
  console.log('');
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const cmd = args._[0];

  if (!cmd || args.help || cmd === 'help') { console.log(HELP); return; }

  const opts = {
    brand: typeof args.brand === 'string' ? args.brand : 'Accessibility Audit',
    name: typeof args.name === 'string' ? args.name : '',
    email: typeof args.email === 'string' ? args.email : '',
    phone: typeof args.phone === 'string' ? args.phone : '',
    pages: args.pages,
    rate: args.rate,
    out: typeof args.out === 'string' ? args.out : 'reports',
    quote: args.quote,
    pdf: args.pdf,
    quiet: false,
  };

  if (cmd === 'scan') {
    const url = args._[1];
    if (!url) { console.error(C.red('Error: a URL is required.\n')); console.log(HELP); process.exit(1); }
    console.log(`\n${C.bold('Scanning')} ${url} ${C.dim(`(up to ${opts.pages || 8} pages)`)}\n`);
    const started = Date.now();
    const r = await runOne({ url }, opts);
    printSummary({ url }, r);
    console.log(C.dim(`  Completed in ${((Date.now() - started) / 1000).toFixed(1)}s\n`));
    return;
  }

  if (cmd === 'batch') {
    const csvPath = args._[1];
    if (!csvPath) { console.error(C.red('Error: a CSV path is required.\n')); console.log(HELP); process.exit(1); }
    if (!fs.existsSync(csvPath)) { console.error(C.red(`Error: no such file: ${csvPath}`)); process.exit(1); }

    let prospects = readProspects(csvPath);
    if (args.limit) prospects = prospects.slice(0, Number(args.limit));
    if (!prospects.length) { console.error(C.red('Error: no rows with a url column found.')); process.exit(1); }

    const outDir = path.resolve(opts.out);
    const summaryPath = path.join(outDir, 'summary.csv');
    const concurrency = Math.max(1, Math.min(4, Number(args.concurrency) || 2));

    console.log(`\n${C.bold('Batch audit')} — ${prospects.length} prospect(s), ${concurrency} at a time\n`);

    let index = 0;
    let done = 0;
    const results = [];
    const usedSlugs = new Set();

    async function worker() {
      while (index < prospects.length) {
        const p = prospects[index++];
        const label = p.name || p.url;
        try {
          const r = await runOne(p, { ...opts, quiet: true }, usedSlugs);
          const d = r.data;
          results.push({ prospect: p, result: r });
          appendSummaryRow(summaryPath, {
            domain: new URL(d.site).hostname,
            name: p.name,
            score: d.score,
            grade: d.grade.letter,
            critical: d.counts.critical,
            serious: d.counts.serious,
            totalFailures: d.totalInstances,
            quoteLow: d.quote.remediationLow,
            quoteHigh: d.quote.remediationHigh,
            reportPath: r.pdfPath || r.htmlPath,
            status: 'ok',
          });
          done++;
          const tone = d.grade.tone === 'good' ? C.green : d.grade.tone === 'bad' ? C.red : C.yellow;
          console.log(
            `  ${C.dim(`[${done}/${prospects.length}]`)} ${label.slice(0, 34).padEnd(34)} ` +
            `${tone(String(d.score).padStart(3))}/100  ${String(d.counts.critical).padStart(2)} crit  ` +
            `${C.dim(`$${d.quote.remediationLow.toLocaleString()}–$${d.quote.remediationHigh.toLocaleString()}`)}`
          );
        } catch (err) {
          done++;
          appendSummaryRow(summaryPath, { domain: p.url, name: p.name, status: `error: ${err.message}` });
          console.log(`  ${C.dim(`[${done}/${prospects.length}]`)} ${label.slice(0, 34).padEnd(34)} ${C.red('failed')} ${C.dim(err.message.slice(0, 40))}`);
        }
      }
    }

    const started = Date.now();
    await Promise.all(Array.from({ length: concurrency }, worker));

    // Worst scores first: those are the prospects with the most to buy.
    results.sort((a, b) => a.result.data.score - b.result.data.score);
    console.log(`\n${C.bold('Best prospects')} ${C.dim('(lowest scores = most to fix = easiest sale)')}`);
    for (const { prospect, result } of results.slice(0, 10)) {
      const d = result.data;
      console.log(`  ${String(d.score).padStart(3)}/100  ${(prospect.name || new URL(d.site).hostname).slice(0, 38).padEnd(38)} ${C.dim(`$${d.quote.remediationLow.toLocaleString()}–$${d.quote.remediationHigh.toLocaleString()}`)}`);
    }
    console.log(`\n  Reports:  ${C.cyan(outDir)}`);
    console.log(`  Summary:  ${C.cyan(summaryPath)}`);
    console.log(C.dim(`\n  Completed in ${((Date.now() - started) / 1000 / 60).toFixed(1)} min\n`));
    return;
  }

  console.error(C.red(`Unknown command: ${cmd}\n`));
  console.log(HELP);
  process.exit(1);
}

main().catch((err) => {
  console.error(`\n${C.red('Failed:')} ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
