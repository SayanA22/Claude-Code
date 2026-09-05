# Itemize

**A line-by-line audit of a hospital bill that takes three minutes, works on a $600 bill,
costs nothing, and writes the appeal letter for you.**

Built as a Blue Ocean Student Entrepreneur Competition entry — a working prototype plus the
strategy work the competition's rubric asks for.

## The problem

A hospital bill arrives as a wall of five-digit codes. Three different things go wrong on
it, and each needs a different argument:

- **Coding errors** — a procedure keyed twice, a lab panel billed alongside the tests it
  already contains, twenty units of a drug that was given once. Factually wrong; they come off.
- **Prices** — a $612 ankle X-ray that Medicare pays $40 for. Not illegal, but every hospital
  has had to publish its own cash price since 2021, which makes it negotiable.
- **Charges federal law already voids** — an out-of-network ER physician's balance bill (No
  Surprises Act), a bill $400 over a good faith estimate (which opens a federal dispute), a
  preventive screening billed with cost sharing (ACA).

The people who can sort this out — billing advocates — take 25–35% of what they save you and
will not touch a bill under a few thousand dollars. So the bills most people actually get,
nobody reads.

## What's here

| | |
|---|---|
| `app/index.html` | **The working prototype.** Parses an itemized bill, runs ten audit rules, drafts the appeal letter and phone script. No server, no build step, no dependencies. |
| `app/strategy.html` | **The strategy pack** — strategy canvas, ERRC grid, three tiers of noncustomers, buyer utility map, business model, feasibility. |
| `docs/pitch-script.md` | The 5-minute video script, timed to 4:45, with the demo sequence to screen-record. |
| `docs/blue-ocean-tools.md` | The four blue ocean tools in text, for slides or judge follow-ups. |
| `docs/research-and-sources.md` | Every statistic used, with its source — and one popular statistic this entry deliberately avoids. |
| `docs/submission-checklist.md` | The competition's rules, the five judging criteria, and a pre-submit checklist. |

Both HTML files are written in artifact format (no `<!doctype>` / `<html>` wrapper), which
browsers render fine. Open either directly:

```
open app/index.html
```

## How the audit engine works

A deterministic rules engine — no language model anywhere in the core, which is what makes it
auditable, explainable to a billing office, and free to run.

**Coding rules.** Duplicate lines; NCCI-style unbundling (panel components billed alongside
the panel); units above the medically unlikely edit for a code; routine supplies already paid
for in the room rate.

**Price rules.** Every coded line is divided by the Medicare rate for that code. Commercial
plans pay roughly 254% of Medicare, so 2.5× is the target price and only lines above 4×
are surfaced.

**Rights rules.** These are coverage-aware, which is the interesting part: an insured patient
with an out-of-network ER clinician gets the No Surprises Act; an uninsured patient billed
$400 over their good faith estimate gets the federal dispute process instead. Toggling
coverage in the app changes which law applies, and the letter changes with it.

Two design decisions worth noting:

1. **Findings that ask to strike a line suppress pricing findings on that line.** You do not
   negotiate the price of a charge you are arguing should not exist.
2. **The headline number is capped per line**, so overlapping findings can never inflate it
   past what that line actually costs.

Medicare reference rates in the prototype are rounded national averages for a demonstration
set of codes, and the app says so. Production reads the live CMS fee schedules and each
hospital's published price file — all of it free and public.

## Not advice

Itemize is a prototype. It is not legal, medical, or financial advice, and it does not replace
a licensed patient advocate or attorney. Nothing typed into it leaves the browser: there is no
server, no account, and no bill data stored anywhere.
