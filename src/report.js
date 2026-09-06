/**
 * Renders the analysis into a single self-contained HTML file.
 * No external assets: it must survive being emailed as an attachment and
 * printed to PDF without a network connection.
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US'));
const ms = (n) => (n === null || n === undefined ? '—' : `${(n / 1000).toFixed(2)}s`);
const money = (n) => `$${Number(n).toLocaleString('en-US')}`;

const IMPACT_LABEL = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

function scoreArc(score) {
  const r = 54;
  const circumference = Math.PI * r; // semicircle
  const filled = (score / 100) * circumference;
  return { r, circumference, filled };
}

function findingRow(rule, index) {
  const samples = rule.samples
    .slice(0, 3)
    .map(
      (s) => `
      <div class="sample">
        <div class="sample-target">${esc(s.target)}</div>
        <pre class="sample-code">${esc(s.html)}</pre>
      </div>`
    )
    .join('');

  const wcagChips = rule.wcag.length
    ? rule.wcag.map((c) => `<span class="chip chip-wcag">WCAG ${esc(c)}</span>`).join('')
    : '<span class="chip chip-wcag">Best practice</span>';

  return `
  <section class="finding" id="finding-${index + 1}">
    <div class="finding-head">
      <div class="finding-num">${index + 1}</div>
      <div class="finding-title">
        <h3>${esc(rule.help)}</h3>
        <div class="finding-chips">
          <span class="chip impact-${esc(rule.impact)}">${IMPACT_LABEL[rule.impact] || esc(rule.impact)}</span>
          <span class="chip chip-level">Level ${esc(rule.level)}</span>
          ${wcagChips}
        </div>
      </div>
      <div class="finding-stats">
        <div><strong>${fmt(rule.instances)}</strong><span>occurrence${rule.instances === 1 ? '' : 's'}</span></div>
        <div><strong>${fmt(rule.pageCount)}</strong><span>page${rule.pageCount === 1 ? '' : 's'}</span></div>
        <div><strong>${rule.estimatedHours}h</strong><span>to fix</span></div>
      </div>
    </div>
    <p class="finding-impact"><strong>What this breaks:</strong> ${esc(rule.humanImpact)}</p>
    <details class="finding-detail" open>
      <summary>Technical detail &amp; examples</summary>
      <p class="finding-desc">${esc(rule.description)}</p>
      ${samples}
      <p class="finding-ref">Reference: <span class="mono">${esc(rule.id)}</span> — ${esc(rule.helpUrl)}</p>
    </details>
  </section>`;
}

export function renderReport(data, opts = {}) {
  const brand = opts.brand || 'Accessibility Audit';
  const contactName = opts.contactName || '';
  const contactEmail = opts.contactEmail || '';
  const contactPhone = opts.contactPhone || '';
  const clientName = opts.clientName || new URL(data.site).hostname.replace(/^www\./, '');
  // Nothing to remediate means nothing to quote — a $0 job is not a sales opportunity.
  const showQuote = opts.showQuote !== false && data.ruleCount > 0;

  const arc = scoreArc(data.score);
  const dateStr = new Date(data.analyzedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const topFindings = data.rules.slice(0, opts.maxFindings ?? 12);

  // Timing APIs are not available everywhere, and a table of zeroes and dashes
  // reads as a broken report rather than a fast site. Show only real numbers,
  // and drop the section entirely when nothing meaningful was measured.
  const perfRows = [
    ['Average page load', ms(data.perf.avgLoadMs), data.perf.avgLoadMs, true],
    ['First contentful paint', ms(data.perf.avgFcpMs), data.perf.avgFcpMs, false],
    ['Largest contentful paint', ms(data.perf.avgLcpMs), data.perf.avgLcpMs, false],
    ['Time to first byte', ms(data.perf.avgTtfbMs), data.perf.avgTtfbMs, false],
    ['Requests per page', fmt(data.perf.avgRequests), data.perf.avgRequests, false],
    ['Page weight', `${fmt(data.perf.avgTransferredKb)} KB`, data.perf.avgTransferredKb, false],
  ]
    // Drop anything that renders as a zero: a sub-5ms timing displays as
    // "0.00s", which reads as a broken measurement rather than a fast one.
    .filter(([, value, raw]) => typeof raw === 'number' && raw > 0 && !/^(0(\.0+)?s|0|0 KB|—)$/.test(value));

  const perfSection = perfRows.length >= 3
    ? `<section class="block">
    <h2>Performance snapshot</h2>
    <p class="muted" style="font-size:14px">Lab measurements taken during the scan. Slow pages compound accessibility problems — assistive technology users are disproportionately affected by long load times.</p>
    <table><tbody>
      ${perfRows.map(([label, value, , strong]) => `<tr><td>${label}</td><td class="num">${strong ? `<strong>${value}</strong>` : value}</td></tr>`).join('')}
    </tbody></table>
  </section>`
    : '';
  const remaining = data.rules.length - topFindings.length;

  const quickWinsHtml = data.quickWins.length
    ? `<ul class="quickwins">${data.quickWins
        .map(
          (r) =>
            `<li><strong>${esc(r.help)}</strong> — ${fmt(r.instances)} occurrence${r.instances === 1 ? '' : 's'}, about ${r.estimatedHours}h of work.</li>`
        )
        .join('')}</ul>`
    : '<p class="muted">No sub-2-hour critical fixes were identified — the issues found need deliberate work rather than quick patches.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility Audit — ${esc(clientName)}</title>
<style>
  :root {
    --ink: #16191d;
    --ink-soft: #4a5058;
    --ink-faint: #7b828c;
    --rule: #e3e6ea;
    --rule-soft: #eff1f4;
    --paper: #ffffff;
    --wash: #f7f8fa;
    --accent: #1f4fd8;
    --critical: #b3261e;
    --serious: #c2620b;
    --moderate: #8a6d0b;
    --minor: #5a6472;
    --good: #1d7a4c;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    background: var(--wash);
    color: var(--ink);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
  }
  .sheet {
    max-width: 860px;
    margin: 0 auto;
    background: var(--paper);
    padding: 56px 64px 72px;
  }
  h1, h2, h3 { line-height: 1.25; margin: 0; font-weight: 650; letter-spacing: -0.015em; }
  h1 { font-size: 34px; }
  h2 { font-size: 21px; margin: 0 0 16px; }
  h3 { font-size: 16px; }
  p { margin: 0 0 14px; }
  .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 0.88em; }
  .muted { color: var(--ink-faint); }

  /* ---- cover ---- */
  .cover { border-bottom: 2px solid var(--ink); padding-bottom: 28px; margin-bottom: 36px; }
  .brandline {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-faint); margin-bottom: 40px;
  }
  .brandline strong { color: var(--ink); font-weight: 650; letter-spacing: 0.12em; }
  .cover .eyebrow { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); font-weight: 650; margin-bottom: 10px; }
  .cover .site { font-size: 17px; color: var(--ink-soft); margin-top: 10px; }
  .cover .standard { font-size: 13px; color: var(--ink-faint); margin-top: 18px; }

  /* ---- score ---- */
  .scorecard {
    display: grid; grid-template-columns: 210px 1fr; gap: 36px;
    align-items: center; background: var(--wash);
    border: 1px solid var(--rule); border-radius: 10px;
    padding: 28px 32px; margin-bottom: 34px;
  }
  .gauge { text-align: center; }
  .gauge svg { display: block; margin: 0 auto; }
  .gauge .num { font-size: 46px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
  .gauge .of { font-size: 13px; color: var(--ink-faint); }
  .gauge .grade { margin-top: 8px; font-size: 13px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; }
  .tone-good { color: var(--good); }
  .tone-ok { color: var(--moderate); }
  .tone-warn { color: var(--serious); }
  .tone-bad { color: var(--critical); }

  .tally { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
  .tally div { border-left: 3px solid var(--rule); padding-left: 12px; }
  .tally strong { display: block; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
  .tally span { font-size: 12px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; }
  .tally .t-critical { border-left-color: var(--critical); } .t-critical strong { color: var(--critical); }
  .tally .t-serious { border-left-color: var(--serious); } .t-serious strong { color: var(--serious); }
  .tally .t-moderate { border-left-color: var(--moderate); } .t-moderate strong { color: var(--moderate); }
  .tally .t-minor { border-left-color: var(--minor); } .t-minor strong { color: var(--minor); }

  /* ---- sections ---- */
  section.block { margin: 0 0 38px; }
  .lede { font-size: 16px; color: var(--ink-soft); }
  .callout {
    border-left: 3px solid var(--accent); background: #f4f7ff;
    padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 20px;
  }
  .callout p:last-child { margin-bottom: 0; }

  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-faint); border-bottom: 1px solid var(--rule); font-weight: 650; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }

  /* ---- findings ---- */
  .finding { border: 1px solid var(--rule); border-radius: 10px; padding: 20px 22px; margin-bottom: 16px; break-inside: avoid; }
  .finding-head { display: grid; grid-template-columns: 34px 1fr auto; gap: 14px; align-items: start; margin-bottom: 12px; }
  .finding-num {
    width: 30px; height: 30px; border-radius: 50%; background: var(--ink); color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 650;
  }
  .finding-chips { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-block; font-size: 11px; font-weight: 650; letter-spacing: 0.04em;
    padding: 3px 9px; border-radius: 20px; border: 1px solid var(--rule); color: var(--ink-soft);
  }
  .impact-critical { background: #fdecea; border-color: #f3c4bf; color: var(--critical); }
  .impact-serious  { background: #fdf1e3; border-color: #f0d2ae; color: var(--serious); }
  .impact-moderate { background: #fbf6e0; border-color: #ead9a6; color: var(--moderate); }
  .impact-minor    { background: #f2f4f7; border-color: #dfe3e9; color: var(--minor); }
  .chip-level { background: #fff; }
  .chip-wcag { background: #f4f7ff; border-color: #d3ddfa; color: var(--accent); }
  .finding-stats { display: flex; gap: 18px; text-align: right; }
  .finding-stats div { min-width: 62px; }
  .finding-stats strong { display: block; font-size: 18px; font-weight: 680; letter-spacing: -0.02em; }
  .finding-stats span { font-size: 11px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.05em; }
  .finding-impact { background: var(--wash); padding: 12px 14px; border-radius: 7px; font-size: 14px; margin-bottom: 12px; }
  .finding-detail summary { cursor: pointer; font-size: 13px; font-weight: 650; color: var(--ink-soft); margin-bottom: 10px; }
  .finding-desc { font-size: 14px; color: var(--ink-soft); }
  .sample { margin-bottom: 10px; }
  .sample-target { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: var(--accent); margin-bottom: 4px; word-break: break-all; }
  .sample-code {
    margin: 0; padding: 10px 12px; background: #f6f7f9; border: 1px solid var(--rule-soft);
    border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; color: #2b3038;
    max-height: 130px; overflow: hidden;
  }
  .finding-ref { font-size: 12px; color: var(--ink-faint); margin: 8px 0 0; word-break: break-all; }
  .quickwins { margin: 0 0 14px; padding-left: 20px; }
  .quickwins li { margin-bottom: 7px; }

  /* ---- quote ---- */
  .quote-box {
    border: 2px solid var(--ink); border-radius: 10px; padding: 26px 30px; margin-top: 8px;
  }
  .quote-figure { font-size: 32px; font-weight: 700; letter-spacing: -0.025em; margin: 6px 0 4px; }
  .quote-terms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--rule); }
  .quote-terms div span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); margin-bottom: 3px; }
  .quote-terms div strong { font-size: 15px; font-weight: 650; }

  footer { margin-top: 46px; padding-top: 20px; border-top: 1px solid var(--rule); font-size: 12px; color: var(--ink-faint); }
  footer strong { color: var(--ink-soft); }

  @media print {
    body { background: #fff; }
    .sheet { max-width: none; padding: 0 12mm; }
    @page { margin: 14mm 0; size: A4; }
    .finding, .scorecard, .quote-box, table { break-inside: avoid; }
    section.block { break-inside: auto; }
    h2 { break-after: avoid; }
    details { open: true; }
    .page-break { break-before: page; }
  }
  @media (max-width: 700px) {
    .sheet { padding: 28px 20px 44px; }
    .scorecard { grid-template-columns: 1fr; gap: 22px; }
    .tally { grid-template-columns: repeat(2, 1fr); }
    .finding-head { grid-template-columns: 1fr; }
    .finding-stats { justify-content: flex-start; text-align: left; }
    .quote-terms { grid-template-columns: 1fr; }
    h1 { font-size: 27px; }
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="brandline">
    <strong>${esc(brand)}</strong>
    <span>${esc(dateStr)}</span>
  </div>

  <header class="cover">
    <div class="eyebrow">Web Accessibility Audit</div>
    <h1>${esc(clientName)}</h1>
    <div class="site">${esc(data.site)}</div>
    <div class="standard">
      Assessed against ${esc(data.standard)} · ${fmt(data.pageCount)} page${data.pageCount === 1 ? '' : 's'} scanned · Automated testing with axe-core
    </div>
  </header>

  <div class="scorecard">
    <div class="gauge">
      <svg width="140" height="82" viewBox="0 0 140 82" role="img" aria-label="Accessibility score ${data.score} out of 100">
        <path d="M 16 70 A 54 54 0 0 1 124 70" fill="none" stroke="#e3e6ea" stroke-width="11" stroke-linecap="round"/>
        <path d="M 16 70 A 54 54 0 0 1 124 70" fill="none"
              stroke="${data.grade.tone === 'good' ? '#1d7a4c' : data.grade.tone === 'ok' ? '#8a6d0b' : data.grade.tone === 'warn' ? '#c2620b' : '#b3261e'}"
              stroke-width="11" stroke-linecap="round"
              stroke-dasharray="${arc.filled.toFixed(1)} ${arc.circumference.toFixed(1)}"/>
      </svg>
      <div class="num">${data.score}</div>
      <div class="of">out of 100</div>
      <div class="grade tone-${esc(data.grade.tone)}">${esc(data.grade.letter)} · ${esc(data.grade.label)}</div>
    </div>
    <div>
      <div class="tally">
        <div class="t-critical"><strong>${fmt(data.counts.critical)}</strong><span>Critical</span></div>
        <div class="t-serious"><strong>${fmt(data.counts.serious)}</strong><span>Serious</span></div>
        <div class="t-moderate"><strong>${fmt(data.counts.moderate)}</strong><span>Moderate</span></div>
        <div class="t-minor"><strong>${fmt(data.counts.minor)}</strong><span>Minor</span></div>
      </div>
      <p style="margin:0;font-size:14px;color:var(--ink-soft)">
        <strong>${fmt(data.ruleCount)}</strong> distinct issue type${data.ruleCount === 1 ? '' : 's'} producing
        <strong>${fmt(data.totalInstances)}</strong> individual failure${data.totalInstances === 1 ? '' : 's'} across
        <strong>${fmt(data.pageCount)}</strong> page${data.pageCount === 1 ? '' : 's'}.
      </p>
    </div>
  </div>

  <section class="block">
    <h2>Executive summary</h2>
    <p class="lede">
      We scanned ${fmt(data.pageCount)} page${data.pageCount === 1 ? '' : 's'} of ${esc(clientName)} against
      ${esc(data.standard)} — the standard US courts and procurement teams reference when assessing whether a
      website is accessible. The scan found <strong>${fmt(data.totalInstances)} individual failures</strong>
      spanning <strong>${fmt(data.ruleCount)} issue type${data.ruleCount === 1 ? '' : 's'}</strong>.
    </p>
    ${
      data.counts.critical + data.counts.serious > 0
        ? `<div class="callout">
             <p><strong>${fmt(data.counts.critical + data.counts.serious)} of these issue types are rated critical or serious</strong>,
             meaning they block or substantially degrade use of the site for people relying on screen readers, keyboard
             navigation, or magnification. These are the categories most commonly cited in accessibility demand letters
             and the ones to address first.</p>
           </div>`
        : `<div class="callout"><p>No critical or serious issues were detected in the automated scan — a genuinely good result. The remaining items are refinements rather than barriers.</p></div>`
    }
    <p>
      Automated testing reliably catches roughly a third of WCAG success criteria — the machine-checkable ones.
      Issues like whether alt text is <em>meaningful</em>, whether focus order is <em>logical</em>, or whether
      an interaction makes sense to a screen-reader user require manual review. Everything in this report is
      a confirmed, reproducible failure; a manual audit would likely surface more.
    </p>
  </section>

  <section class="block">
    <h2>Fastest wins</h2>
    <p>These are the highest-impact issues with the lowest remediation cost — the place to start.</p>
    ${quickWinsHtml}
  </section>

  <section class="block page-break">
    <h2>Findings, by priority</h2>
    <p class="muted" style="font-size:14px">
      Ordered by severity, then by how widely each issue appears across the site.
    </p>
    ${topFindings.map(findingRow).join('')}
    ${
      remaining > 0
        ? `<p class="muted"><em>${fmt(remaining)} additional lower-severity issue type${remaining === 1 ? '' : 's'} ${remaining === 1 ? 'was' : 'were'} identified and ${remaining === 1 ? 'is' : 'are'} included in the full data export accompanying this report.</em></p>`
        : ''
    }
  </section>

  <section class="block">
    <h2>Pages scanned</h2>
    <table>
      <thead>
        <tr><th>URL</th><th class="num">Failures</th><th class="num">Issue types</th><th class="num">Load time</th></tr>
      </thead>
      <tbody>
        ${data.scannedPages
          .map(
            (p) => `<tr>
              <td class="mono" style="word-break:break-all">${esc(p.url.replace(data.site, '') || '/')}</td>
              <td class="num">${fmt(p.violationCount)}</td>
              <td class="num">${fmt(p.ruleCount)}</td>
              <td class="num">${ms(p.loadMs)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${
      data.failedPages.length
        ? `<p class="muted" style="margin-top:12px;font-size:13px">${fmt(data.failedPages.length)} page${data.failedPages.length === 1 ? '' : 's'} could not be loaded during the scan.</p>`
        : ''
    }
  </section>

  ${perfSection}

  ${
    showQuote
      ? `<section class="block">
    <h2>Remediation scope &amp; investment</h2>
    <p>
      The estimate below covers fixing every issue in this report, retesting with assistive technology,
      and a verification pass confirming each fix holds.
    </p>
    <div class="quote-box">
      <span class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em">Estimated remediation investment</span>
      <div class="quote-figure">${money(data.quote.remediationLow)} – ${money(data.quote.remediationHigh)}</div>
      <p class="muted" style="font-size:13px;margin:0">
        Based on approximately ${data.quote.remediationHours} hours of engineering and QA.
      </p>
      <div class="quote-terms">
        <div><span>Scope</span><strong>${fmt(data.ruleCount)} issue types</strong></div>
        <div><span>Typical timeline</span><strong>${data.quote.remediationHours <= 20 ? '1–2 weeks' : data.quote.remediationHours <= 60 ? '3–5 weeks' : '6–10 weeks'}</strong></div>
        <div><span>Deliverable</span><strong>Verified fixes + retest</strong></div>
      </div>
    </div>
  </section>`
      : ''
  }

  <section class="block">
    <h2>Recommended next steps</h2>
    <ol>
      <li><strong>Remediate critical and serious issues first.</strong> They carry the most legal exposure and lock the most people out.</li>
      <li><strong>Commission a manual audit</strong> to cover the roughly two-thirds of WCAG criteria automated tools cannot evaluate.</li>
      <li><strong>Publish an accessibility statement</strong> documenting your conformance level and how users can report barriers. This is a documented good-faith signal.</li>
      <li><strong>Add automated checks to your build</strong> so new regressions are caught before they ship rather than months later.</li>
    </ol>
  </section>

  <footer>
    <p><strong>${esc(brand)}</strong>${contactName ? ` · ${esc(contactName)}` : ''}${contactEmail ? ` · ${esc(contactEmail)}` : ''}${contactPhone ? ` · ${esc(contactPhone)}` : ''}</p>
    <p>
      Report generated ${esc(dateStr)} using axe-core against ${esc(data.standard)}.
      Automated testing identifies machine-detectable failures only and does not constitute a legal
      compliance certification. This document is a technical assessment, not legal advice.
    </p>
  </footer>

</div>
</body>
</html>`;
}
