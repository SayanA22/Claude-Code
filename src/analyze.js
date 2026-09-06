/**
 * Turns raw scan output into the things a buyer actually cares about:
 * how bad is it, what does it break for real people, what does it cost to fix.
 */

const IMPACT_WEIGHT = { critical: 10, serious: 6, moderate: 3, minor: 1 };
const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

/**
 * Remediation effort model. `fixed` is the one-time cost of understanding and
 * setting up the fix; `perInstance` is the marginal cost per occurrence, which
 * decays because the 40th missing alt attribute is much faster than the first.
 * Hours are deliberately conservative — quoting short is how you lose money.
 */
const EFFORT = {
  'color-contrast':            { fixed: 1.5, perInstance: 0.05, cap: 10 },
  'image-alt':                 { fixed: 0.5, perInstance: 0.08, cap: 8 },
  'link-name':                 { fixed: 0.5, perInstance: 0.10, cap: 8 },
  'button-name':               { fixed: 0.5, perInstance: 0.10, cap: 6 },
  'label':                     { fixed: 0.75, perInstance: 0.15, cap: 6 },
  'form-field-multiple-labels':{ fixed: 0.5, perInstance: 0.10, cap: 4 },
  'aria-required-attr':        { fixed: 1.0, perInstance: 0.15, cap: 6 },
  'aria-valid-attr-value':     { fixed: 1.0, perInstance: 0.12, cap: 6 },
  'aria-hidden-focus':         { fixed: 1.0, perInstance: 0.15, cap: 5 },
  'aria-allowed-attr':         { fixed: 1.0, perInstance: 0.12, cap: 5 },
  'html-has-lang':             { fixed: 0.25, perInstance: 0.02, cap: 1 },
  'html-lang-valid':           { fixed: 0.25, perInstance: 0.02, cap: 1 },
  'document-title':            { fixed: 0.25, perInstance: 0.05, cap: 2 },
  'heading-order':             { fixed: 1.0, perInstance: 0.10, cap: 6 },
  'page-has-heading-one':      { fixed: 0.5, perInstance: 0.10, cap: 3 },
  'landmark-one-main':         { fixed: 0.75, perInstance: 0.10, cap: 3 },
  'region':                    { fixed: 1.0, perInstance: 0.08, cap: 5 },
  'bypass':                    { fixed: 1.0, perInstance: 0.10, cap: 3 },
  'frame-title':               { fixed: 0.5, perInstance: 0.10, cap: 3 },
  'list':                      { fixed: 0.5, perInstance: 0.08, cap: 4 },
  'listitem':                  { fixed: 0.5, perInstance: 0.08, cap: 4 },
  'duplicate-id':              { fixed: 0.5, perInstance: 0.05, cap: 4 },
  'meta-viewport':             { fixed: 0.5, perInstance: 0.05, cap: 2 },
  'tabindex':                  { fixed: 1.0, perInstance: 0.15, cap: 5 },
  'scrollable-region-focusable':{ fixed: 1.0, perInstance: 0.15, cap: 5 },
  'nested-interactive':        { fixed: 1.5, perInstance: 0.25, cap: 8 },
  'select-name':               { fixed: 0.5, perInstance: 0.10, cap: 4 },
  'video-caption':             { fixed: 2.0, perInstance: 1.00, cap: 20 },
  'object-alt':                { fixed: 0.5, perInstance: 0.15, cap: 4 },
};
const DEFAULT_EFFORT = { fixed: 1.0, perInstance: 0.12, cap: 6 };

/** Plain-English consequence. Buyers do not care about rule IDs; they care who is locked out. */
const HUMAN_IMPACT = {
  'color-contrast': 'Text is too low-contrast to read for users with low vision, color blindness, or anyone on a phone in daylight.',
  'image-alt': 'Screen readers announce nothing for these images, so blind users miss the content — including, often, product photos and calls to action.',
  'link-name': 'Links have no readable name, so screen-reader users hear "link" with no idea where it goes.',
  'button-name': 'Buttons have no accessible name. A screen-reader user cannot tell what the button does before pressing it.',
  'label': 'Form fields have no associated label, so assistive tech cannot tell the user what to type. This is the single most common reason a checkout or contact form is unusable.',
  'aria-required-attr': 'ARIA widgets are missing required attributes, so assistive tech misreports their state.',
  'aria-hidden-focus': 'Elements hidden from screen readers can still be reached by keyboard, stranding keyboard users on invisible controls.',
  'html-has-lang': 'The page does not declare a language, so screen readers may read it with the wrong pronunciation engine.',
  'document-title': 'The page has no title, so users with many tabs open — and search engines — cannot identify it.',
  'heading-order': 'Headings skip levels, breaking the document outline screen-reader users rely on to navigate.',
  'page-has-heading-one': 'The page has no top-level heading, removing the main navigation landmark for assistive tech.',
  'landmark-one-main': 'There is no <main> landmark, so users cannot jump straight to the primary content.',
  'region': 'Content sits outside any landmark region, making the page harder to navigate by structure.',
  'bypass': 'There is no way to skip repeated navigation, forcing keyboard users to tab through the entire menu on every page.',
  'frame-title': 'Embedded frames have no title, so screen-reader users cannot tell what is inside them.',
  'nested-interactive': 'Interactive controls are nested inside each other, producing unpredictable keyboard and screen-reader behavior.',
  'video-caption': 'Video has no captions, excluding deaf and hard-of-hearing users and anyone watching with sound off.',
  'select-name': 'Dropdowns have no accessible name, so their purpose is unannounced.',
  'tabindex': 'Positive tabindex values override the natural focus order, making keyboard navigation jump unpredictably.',
  'scrollable-region-focusable': 'Scrollable areas cannot be reached by keyboard, hiding their content from keyboard-only users.',
};

/** Map axe tags to the WCAG success criteria a lawyer or procurement form will ask about. */
export function wcagCriteria(tags = []) {
  const out = [];
  for (const t of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(t);
    if (m) out.push(`${m[1]}.${m[2]}.${m[3]}`);
  }
  return [...new Set(out)].sort();
}

function levelFromTags(tags = []) {
  if (tags.includes('wcag2aaa')) return 'AAA';
  if (tags.some((t) => /aa$/.test(t))) return 'AA';
  if (tags.some((t) => /a$/.test(t))) return 'A';
  return '—';
}

function estimateHours(ruleId, instances) {
  const model = EFFORT[ruleId] ?? DEFAULT_EFFORT;
  // Diminishing marginal cost: repetition gets faster.
  const marginal = model.perInstance * Math.pow(instances, 0.75);
  return Math.min(model.cap, model.fixed + marginal);
}

/**
 * 0-100 readiness score. Anchored on weighted defects per page so a 40-page site
 * is not automatically scored worse than a 4-page one.
 */
function computeScore(rules, pageCount) {
  const weighted = rules.reduce(
    (sum, r) => sum + IMPACT_WEIGHT[r.impact] * Math.pow(r.instances, 0.6),
    0
  );
  const perPage = weighted / Math.max(1, pageCount);
  // Tuned so a clean site lands 95+, a typical small-business site 55-75, a bad one under 40.
  const score = 100 * Math.exp(-perPage / 45);
  return Math.max(1, Math.min(100, Math.round(score)));
}

function grade(score) {
  if (score >= 90) return { letter: 'A', label: 'Low risk', tone: 'good' };
  if (score >= 75) return { letter: 'B', label: 'Some exposure', tone: 'ok' };
  if (score >= 60) return { letter: 'C', label: 'Meaningful exposure', tone: 'warn' };
  if (score >= 40) return { letter: 'D', label: 'High exposure', tone: 'bad' };
  return { letter: 'F', label: 'Severe exposure', tone: 'bad' };
}

export class ScanFailedError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = 'ScanFailedError';
    this.failures = failures;
  }
}

export function analyze(scan, opts = {}) {
  const hourlyRate = opts.hourlyRate ?? 150;
  const pages = scan.pages.filter((p) => p.ok);
  const failedPages = scan.pages.filter((p) => !p.ok);

  // A site that never loaded has zero violations, which would otherwise score a
  // perfect 100 and produce a report telling a client they are fully compliant.
  // Refuse to analyze rather than emit a confidently wrong document.
  if (!pages.length) {
    const reason = failedPages[0]?.error || 'no pages could be loaded';
    throw new ScanFailedError(
      `Scan failed: none of the ${scan.pages.length} attempted page(s) loaded. First error: ${reason.split('\n')[0]}`,
      failedPages
    );
  }

  // Roll rule occurrences up across every page.
  const byRule = new Map();
  for (const page of pages) {
    for (const v of page.violations) {
      const existing = byRule.get(v.id);
      if (existing) {
        existing.instances += v.nodeCount;
        existing.pages.push(page.url);
        if (existing.samples.length < 4) {
          existing.samples.push(...v.samples.slice(0, 4 - existing.samples.length));
        }
      } else {
        byRule.set(v.id, {
          id: v.id,
          impact: v.impact,
          help: v.help,
          description: v.description,
          helpUrl: v.helpUrl,
          tags: v.tags,
          wcag: wcagCriteria(v.tags),
          level: levelFromTags(v.tags),
          humanImpact: HUMAN_IMPACT[v.id] || v.description,
          instances: v.nodeCount,
          pages: [page.url],
          samples: v.samples.slice(0, 4),
        });
      }
    }
  }

  const rules = [...byRule.values()].map((r) => ({
    ...r,
    pages: [...new Set(r.pages)],
    pageCount: new Set(r.pages).size,
    estimatedHours: Math.round(estimateHours(r.id, r.instances) * 10) / 10,
  }));

  // Priority: legal impact first, then blast radius.
  rules.sort((a, b) => {
    const d = IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
    if (d !== 0) return d;
    return b.instances - a.instances;
  });

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let totalInstances = 0;
  for (const r of rules) {
    counts[r.impact] = (counts[r.impact] || 0) + 1;
    totalInstances += r.instances;
  }

  const score = computeScore(rules, Math.max(1, pages.length));
  const g = grade(score);

  const rawHours = rules.reduce((s, r) => s + r.estimatedHours, 0);
  // Overhead: QA, assistive-tech retesting, coordination, and a fix-verification pass.
  const totalHours = Math.max(2, Math.round(rawHours * 1.35 * 10) / 10);
  const quote = {
    hourlyRate,
    remediationHours: totalHours,
    remediationLow: Math.round((totalHours * hourlyRate * 0.85) / 50) * 50,
    remediationHigh: Math.round((totalHours * hourlyRate * 1.25) / 50) * 50,
  };

  // Perf rollup — a useful second hook when accessibility alone does not land.
  const perfPages = pages.filter((p) => p.perf);
  const avg = (fn) => {
    const vals = perfPages.map(fn).filter((v) => typeof v === 'number' && Number.isFinite(v));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const perf = {
    avgLoadMs: avg((p) => p.perf.loadMs),
    avgFcpMs: avg((p) => p.perf.firstContentfulPaintMs),
    avgLcpMs: avg((p) => p.perf.largestContentfulPaintMs),
    avgTtfbMs: avg((p) => p.perf.ttfbMs),
    avgRequests: avg((p) => p.perf.requestCount),
    avgTransferredKb: avg((p) => Math.round(p.perf.transferredBytes / 1024)),
  };

  // Cheap credibility wins to open the report with.
  const quickWins = rules
    .filter((r) => r.estimatedHours <= 1.5 && (r.impact === 'critical' || r.impact === 'serious'))
    .slice(0, 5);

  const meta = {
    pagesMissingLang: pages.filter((p) => p.meta && !p.meta.lang).length,
    pagesMissingTitle: pages.filter((p) => p.meta && !p.meta.title).length,
    pagesMissingH1: pages.filter((p) => p.meta && p.meta.h1Count === 0).length,
    pagesMissingViewport: pages.filter((p) => p.meta && !p.meta.hasViewportMeta).length,
    totalImagesMissingAlt: pages.reduce((s, p) => s + (p.meta?.imagesMissingAlt || 0), 0),
    totalUnlabeledFields: pages.reduce((s, p) => s + (p.meta?.unlabeledFormFields || 0), 0),
    pagesWithoutSkipLink: pages.filter((p) => p.meta && !p.meta.hasSkipLink).length,
  };

  return {
    ...scan,
    pageCount: pages.length,
    attemptedPageCount: scan.pages.length,
    analyzedAt: new Date().toISOString(),
    score,
    grade: g,
    counts,
    ruleCount: rules.length,
    totalInstances,
    rules,
    quickWins,
    quote,
    perf,
    meta,
    scannedPages: pages.map((p) => ({
      url: p.url,
      httpStatus: p.httpStatus,
      violationCount: p.violations.reduce((s, v) => s + v.nodeCount, 0),
      ruleCount: p.violations.length,
      loadMs: p.perf?.loadMs ?? null,
    })),
    failedPages: failedPages.map((p) => ({ url: p.url, error: p.error })),
  };
}

export { estimateHours, grade, computeScore };
