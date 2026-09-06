# Accessibility Audit Kit

A tool that scans websites for WCAG accessibility failures and produces
client-ready reports — plus the playbook for turning those reports into paid work.

The scan is automated. The report is the product. The playbook is how it
becomes revenue.

---

## Why this is a business and not just a script

Accessibility remediation is one of the few service niches where a cold
prospect can be handed **proof of their problem before they ever speak to
you** — at effectively zero cost per prospect. You are not claiming a business
might have an issue; you are attaching a document listing the exact elements on
their exact site that fail, with WCAG references and a remediation estimate.

There is also a deadline. The DOJ's April 2024 ADA Title II rule requires US
state and local government entities — cities, school districts, libraries,
transit authorities — to meet **WCAG 2.1 Level AA**, on published compliance
dates. That is a large population of buyers with a legal obligation, public
contact details, and procurement processes built to buy exactly this.

**Start with [`playbook/00-the-business.md`](playbook/00-the-business.md)** for
the honest version: unit economics, a realistic funnel, and what actually goes
wrong.

---

## Quick start

```bash
npm install
npm test          # 36 tests, runs against a local fixture — no network needed
```

Audit a single site:

```bash
node bin/audit.js scan https://example.com \
  --brand "Northside Digital" \
  --name "Sam Rivera" \
  --email sam@northside.com \
  --rate 165
```

Produces, in `reports/`:
- `{domain}-accessibility-audit.pdf` — the client deliverable
- `{domain}-accessibility-audit.html` — same report, self-contained
- `{domain}-data.json` — full structured findings

Generate free sample reports for outreach at volume:

```bash
node bin/audit.js batch prospects.csv \
  --brand "Northside Digital" --no-quote --pages 5
```

Writes one report per prospect plus `reports/summary.csv`, ranked worst-first.
**The worst scores are your best prospects** — the more broken the site, the
more obvious the value and the easier the conversation.

CSV format (`url` is the only required column):

```csv
url,name,contact,email
https://example-dental.com,Example Dental,Dr. Rivera,front@example-dental.com
```

---

## What the report contains

- **Score out of 100** with a letter grade, normalised per page so a large site
  isn't penalised for being large
- **Severity breakdown** — critical / serious / moderate / minor
- **Executive summary** in plain language, no jargon
- **Fastest wins** — highest impact, lowest effort, to open the conversation
- **Prioritised findings** with WCAG success criteria, real code samples from
  their site, and a per-issue fix estimate
- **What each issue breaks for real people** — the sentence that sells the work
- **Performance snapshot** — a second hook when accessibility alone doesn't land
- **Remediation scope and price range**, driven by your `--rate`

See [`examples/sample-report.html`](examples/sample-report.html) — a real
generated report, produced by the test fixture.

---

## Options

| Flag | Effect |
|---|---|
| `--brand <name>` | Your business name on the report |
| `--name` / `--email` / `--phone` | Your contact details in the footer |
| `--pages <n>` | Max pages per site (default 8) |
| `--rate <n>` | Your hourly rate — drives the quote (default 150) |
| `--out <dir>` | Output directory (default `./reports`) |
| `--no-quote` | Omit pricing — **use this for free sample reports** |
| `--no-pdf` | HTML only, skip PDF rendering |
| `--limit <n>` | batch: stop after N prospects |
| `--concurrency <n>` | batch: sites in parallel (default 2) |

---

## How it works

```
bin/audit.js      CLI — scan and batch commands
src/scanner.js    Crawls same-origin pages, runs axe-core, collects timings
src/analyze.js    Rolls findings up, scores, estimates effort, builds the quote
src/report.js     Renders the self-contained HTML report
src/pdf.js        Prints the report to PDF
src/batch.js      CSV prospect lists and run summaries
src/browser.js    Chromium resolution and proxy handling
test/             Fixture site + 36 end-to-end tests
```

Detection is [axe-core](https://github.com/dequelabs/axe-core), the same engine
behind Chrome DevTools' accessibility panel and Deque's commercial tooling. It
reports **confirmed, reproducible failures** — findings you can defend on a
call.

### Two behaviours worth knowing about

**A failed scan never looks like a clean site.** If no page loads, `analyze()`
throws rather than reporting a perfect score. Zero violations because a site was
unreachable would otherwise generate a report telling a client they're fully
compliant — the single most damaging bug this tool could have.

**Duplicate pages don't burn the crawl budget.** `/` and `/index.html` are the
same document; the crawler fingerprints rendered content so your page budget is
spent on genuinely distinct pages.

---

## Requirements

- Node 18+
- Chromium via Playwright — `npx playwright install chromium`

If Chromium is already provisioned elsewhere (CI images, sandboxes), it's
detected automatically, and `HTTPS_PROXY` is honoured if set.

---

## The playbook

| | |
|---|---|
| [00 — The business](playbook/00-the-business.md) | Model, unit economics, realistic funnel |
| [01 — Offer and pricing](playbook/01-offer-and-pricing.md) | What to sell, what to charge |
| [02 — Finding prospects](playbook/02-finding-prospects.md) | Where the lists come from |
| [03 — Outreach](playbook/03-outreach.md) | Templates that get replies |
| [04 — The call](playbook/04-sales-call.md) | Structure, objections, closing |
| [05 — Delivery](playbook/05-delivery.md) | Doing the work, keeping the margin |
| [06 — 30-day plan](playbook/06-30-day-plan.md) | Day by day |
| [Legal and ethics](playbook/legal-and-ethics.md) | **Read before sending anything** |

---

## Limits, stated plainly

**Automated testing catches roughly a third of WCAG success criteria** — the
machine-checkable ones. Whether alt text is *meaningful*, whether focus order is
*logical*, whether a flow makes sense to a screen-reader user: all need a human.
Say this to every client. It sets honest expectations and it's why your manual
pass has value.

**This tool does not make you money on its own.** It removes the cost of proving
a prospect has a problem. The outreach, the calls, and the delivery are still
work, and the playbook is specific about how much.

**Nothing here is legal advice**, and you must not present it to clients as
such. See [`playbook/legal-and-ethics.md`](playbook/legal-and-ethics.md).
