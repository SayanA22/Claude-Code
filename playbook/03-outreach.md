# Outreach

## The one rule

**Lead with the report. Attach it. Ask for nothing.**

Almost every cold email a business receives is a stranger asking for time. You
are sending a genuinely useful document about their own website, produced
before they ever spoke to you, with no obligation attached. That difference is
the entire reason this works — do not throw it away by bolting a pitch onto it.

## Before you send anything

Read `legal-and-ethics.md`. Cold B2B email is lawful in the US under CAN-SPAM
if you follow specific rules, and is materially more restricted in the EU, UK,
and Canada. The rules are short. Follow them.

---

## Email 1 — the report

Subject lines that work (all plain, none clickbait):

- `Accessibility issues on {domain}`
- `Found 12 accessibility problems on your site — report attached`
- `{Company} website — WCAG audit (no charge)`

```
Hi {First name},

I run automated accessibility scans on {industry} websites in {area}. I ran
one on {domain} this week and thought you'd want the results.

The scan found {N} issues, {M} of them rated critical or serious. The three
that stood out:

  • {Specific finding — e.g. "Your appointment form's fields have no labels,
    so screen-reader users can't tell what to type in them"}
  • {Specific finding}
  • {Specific finding}

Full report attached — it lists every issue, where it appears, and what it
takes to fix. It's yours to keep, and your web person can work straight from
it. No charge and nothing expected.

If it's useful and you'd like me to walk you through the priority items, I'm
happy to. Either way, I hope it helps.

{Your name}
{Business name} · {phone} · {website}

Don't want emails from me? Reply "stop" and I won't contact you again.
```

**Why this works:** you have already done the work. There is no ask. The
opt-out is honest and required. The specificity proves it is not a template
blast — because it isn't; you read the report first.

### Personalising the three bullets

This is the only part that takes real time, and it is the part that earns the
reply. Open the generated report, take the top three findings, and rewrite each
in terms of *their* business:

- `label` on a contact form → "someone using a screen reader can't fill in your
  contact form"
- `image-alt` on a menu or product page → "your {products} are invisible to
  screen-reader users, and to search engines"
- `color-contrast` in body copy → "your body text is hard to read for anyone
  with low vision, and on a phone outdoors"

Never paste the raw rule ID into an email. `image-alt` means nothing to a
dentist.

---

## Email 2 — follow-up (day 4)

```
Hi {First name},

Following up on the accessibility report I sent Tuesday — did it reach you?

Happy to answer questions about any of it, no strings. If it's not relevant
right now, just say so and I'll leave you be.

{Your name}

Reply "stop" to opt out.
```

## Email 3 — final (day 10)

```
Hi {First name},

Last note from me on this. If accessibility becomes a priority later, the
report I sent stays valid — and I'm around.

One thing worth knowing regardless of whether you work with me: the issues in
that report are the categories that turn up most often in accessibility demand
letters. The critical ones are worth fixing whoever does it.

Best of luck,
{Your name}

Reply "stop" to opt out.
```

**Three emails. Then stop.** A fourth does not get replies; it gets complaints.

---

## The public-entity variant

Different framing: they have an obligation, not just a risk.

```
Hi {First name},

I work with {state} public agencies on WCAG 2.1 AA conformance under the DOJ's
ADA Title II web accessibility rule.

I ran an automated scan of {domain} and attached the results — {N} issues,
{M} critical or serious, mapped to the specific WCAG success criteria each one
falls under.

If it's helpful I can put together a scoped remediation quote in whatever
format your procurement process needs.

The report is yours regardless, and there's no cost for it.

{Your name}
{Business name} · {phone}

Reply "stop" to opt out.
```

Attach the report **with** the quote for these — public entities usually need a
number before they can even start an internal conversation.

---

## The agency variant (highest leverage)

```
Hi {First name},

You build sites for {client type}. Accessibility is going to come up in your
client conversations — it already is in ours.

I ran a scan on {one of their client sites or their own site}: {N} issues,
{M} critical. Report attached.

I do this white-label for agencies — audits and remediation delivered under
your name, your margin on top. If that's interesting, worth fifteen minutes?

{Your name}

Reply "stop" to opt out.
```

---

## LinkedIn (works well for agencies and public entities)

```
Hi {First name} — I ran an accessibility scan on {domain} and it flagged
{N} issues, {M} critical. Happy to send the report over, no charge and no
pitch. Want it?
```

Short, and it asks permission before sending an attachment. Higher reply rate
than email for agency and public-sector contacts.

---

## Tracking

Add these columns to your prospect CSV and keep it current. The tool writes
`reports/summary.csv`; your pipeline tracking is yours to maintain.

```csv
url,name,contact,email,score,sent_date,followup1,followup2,reply,call_booked,outcome,notes
```

**Do not skip this.** By week three you will have contacted 300 organisations
and you will not remember who said what. Deals are lost in the gap between
"interested" and "followed up".

## What good looks like

| Metric | Expect | Investigate below |
|---|---|---|
| Open rate | 40–60% | 30% → subject line |
| Reply rate | 8–15% | 5% → bullets aren't specific enough |
| Reply → call | 30–50% | 20% → you're pitching too hard on reply |
| Call → close | 20–35% | 15% → price or scope is wrong |

If replies are low, the problem is almost always that your three bullets are
generic. Rewrite them for the specific business, not the rule.
