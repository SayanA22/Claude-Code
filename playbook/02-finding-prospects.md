# Where the prospects come from

You need a list of organisations with (a) a website, (b) money, and (c) a
reason to care. Ranked by how well they convert from cold.

## Tier 1 — Public entities (best cold-outreach targets)

State and local government bodies have an explicit WCAG 2.1 AA obligation
under the DOJ's ADA Title II rule, published contact details, and procurement
processes designed to buy exactly this.

Where to find them:
- State directories of municipalities, school districts, and special districts
- State department-of-education lists of districts and schools
- State library association member lists
- Regional transit and utility authority directories
- `.gov` and `.k12.__.us` domains

Why they convert: the obligation is not a matter of opinion, the deadline is
public, and someone in the organisation is already responsible for it. Your
email often lands as *help* rather than as an interruption.

Note that they buy slowly. Purchase orders, budget cycles, sometimes a formal
quote process. Start these early; they are your month-two and month-three
revenue, not your week-one revenue.

## Tier 2 — Regulated and high-exposure private businesses

Healthcare, legal, financial services, hospitality, e-commerce, education.
They have compliance awareness, real budget, and genuine litigation exposure.

Where to find them:
- Local chamber of commerce member directories
- Professional association listings (dental, legal, medical, accounting)
- Franchise location directories
- "Best of" and local award lists — those businesses have marketing budget

## Tier 3 — Agencies and web shops (highest leverage)

A small agency has 20–100 client sites. Sell them one audit, and if it lands
you can become their white-label accessibility provider.

This is the single highest-leverage move in this playbook: one relationship,
many sites, recurring work, no cold outreach per client.

Pitch it differently: not "your site is broken" but "your clients are going to
start asking about this and you don't have an answer — I can be the answer,
white-labelled under your name."

## Tier 4 — Non-profits and associations

Smaller budgets, but mission-aligned: accessibility is genuinely on-brand for
them, and they talk to each other. Good for testimonials and referrals early
on, when you need proof more than margin.

## Building the list

Aim for **50 prospects a day**, which is under an hour once you have a rhythm.

Required CSV columns — `url` is the only mandatory one:

```csv
url,name,contact,email
https://example-dental.com,Example Dental,Dr. Rivera,front@example-dental.com
https://example-library.org,Example Public Library,,info@example-library.org
```

Then:

```bash
node bin/audit.js batch prospects.csv --brand "Your Agency" --no-quote --pages 5
```

The run writes `reports/summary.csv` ranked by score, and prints the ten worst
sites at the end. **Those are your best prospects** — the worse the site, the
more obvious the value and the easier the conversation.

## Qualifying before you spend time

Skip a prospect if:
- The score is above 85 — there is not enough to talk about
- The site is clearly abandoned (no updates, dead links, expired copyright)
- It is a national chain — the website decision is made three states away
- There is no findable human contact, only a `no-reply@` address

Prioritise a prospect if:
- Score under 50 with several critical issues
- The site was obviously built recently or redesigned (someone owns it and cares)
- They are hiring for marketing or web roles (there is budget and a decision-maker)
- They are a public entity of any kind
