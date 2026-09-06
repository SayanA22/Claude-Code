# The 30-day plan

Assumes roughly 2–3 hours a day. Adjust the pace, keep the order — each week
depends on the one before it.

## Week 1 — Set up and prove it works

**Day 1 — Infrastructure**
- `npm install`, then `npm test` (should be 36 passing)
- Run one scan on a site you know: `node bin/audit.js scan https://yoursite.com`
- Open the PDF. This is your product — decide whether you'd pay for it.
- Register a business name, get an email address on a real domain.
  `you@yourname.com` gets replies; `yourname47@gmail.com` does not.

**Day 2 — Pick one niche**
Choose *one*: dental practices, law firms, school districts, public libraries,
restaurants, agencies. One niche means one email template, one set of examples,
and a reputation that compounds. Spreading across five niches means starting
from zero five times.

**Day 3 — Build your first list**
50 prospects in the CSV. Chamber of commerce directories and association member
lists are the fastest sources.

**Day 4 — Run the first batch**
```bash
node bin/audit.js batch prospects.csv --brand "Your Business" --no-quote --pages 5
```
Read `reports/summary.csv`. Sort by score. Get a feel for what a 30 looks like
versus a 70.

**Day 5 — Write your outreach**
Adapt the template in `03-outreach.md` to your niche. Read
`legal-and-ethics.md` properly. Set up your opt-out handling before a single
email goes out.

**Days 6–7 — Send the first 25**
Personalise the three bullets for every one. Yes, all of them. This is the work.
Log everything in your tracking CSV.

> **Week 1 outcome:** infrastructure working, 25 real prospects contacted.
> Probably zero replies yet. That is normal — do not change anything yet.

## Week 2 — Volume and first conversations

**Days 8–9** — Send 25 more. Follow up on week 1's batch (email 2).
**Day 10** — Build the next 50-prospect list. Run the batch overnight.
**Days 11–12** — Send 50. Handle replies immediately — same-day response
roughly doubles your booking rate.
**Day 13** — First calls. Use the structure in `04-sales-call.md`. You will be
bad at the first one. Do it anyway.
**Day 14** — Send proposals within 24 hours of every call. Review your numbers:
what is your actual reply rate?

> **Week 2 outcome:** ~100 contacted, 5–15 replies, 2–5 calls booked.

## Week 3 — Close the first client

**Days 15–17** — Keep sending 50/day. This is the week people stop, and it is
the week the pipeline from week 1 starts converting.
**Day 18** — Follow up on every outstanding proposal. Deals close on the
second follow-up.
**Days 19–21** — Deliver for anyone who has said yes. Over-deliver on the first
one specifically — you are buying a testimonial and a case study, and both are
worth more than the invoice.

> **Week 3 outcome:** first client closed, or at minimum a proposal
> outstanding with a real decision-maker.

## Week 4 — Systematise

**Days 22–24** — Deliver. Ask every happy client for (a) a written testimonial
and (b) one referral. Ask directly; most people say yes and almost nobody is
asked.
**Day 25** — Write up your first case study: before score, after score, what
you fixed, what it cost. One page.
**Days 26–28** — Approach agencies (Tier 3 in `02-finding-prospects.md`), now
with a case study in hand. This is where the leverage is.
**Days 29–30** — Review the month honestly:
- Prospects contacted, replies, calls, closes, revenue
- Which niche responded best?
- Which of the three bullets got quoted back to you in replies?

Then set month two's target from *your* real numbers, not from these.

## The scoreboard

| | Target by day 30 |
|---|---|
| Prospects scanned | 300+ |
| Emails sent | 200+ |
| Replies | 15–30 |
| Calls | 5–12 |
| Clients closed | 1–3 |
| Revenue | $1,000 – $5,000 |

## If day 30 arrives with nothing closed

Diagnose in this order — it is almost always the first one.

1. **Under 200 emails sent?** It is volume. Nothing else. Keep going.
2. **Reply rate under 5%?** Your three bullets are generic. Rewrite them for
   the specific business. This is the highest-leverage fix available to you.
3. **Replies but no calls?** You are pitching on the reply instead of just
   offering to walk them through it.
4. **Calls but no closes?** Your price is unanchored or your scope is vague.
   Use the three-package structure and recommend the middle one.
5. **All of the above look fine?** Wrong niche. Switch, and take everything you
   learned with you.

The one failure mode with no recovery is stopping in week two.
