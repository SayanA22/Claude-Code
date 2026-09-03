# Net Thirty

What your clients actually pay you, per hour of your life, after the hours you
never billed and the weeks you waited to get paid.

Freelancers already know their rate. The rate is not the number that matters.
The number that matters is the fee divided by *every* hour the client took —
the status calls, the fourth round of revisions, the proposal written for free,
the fixed scope that ran to twice its quote. Net Thirty does that division on
every client and says what to do about each one before the next invoice goes
out.

## What it tells you

- **The effective rate per client.** Solid bar against a hollow one: what you
  cleared per hour, next to the rate on the contract, both against your floor.
- **The number to quote next time.** Not "charge more" — your floor grossed up
  for the hours that particular client does not pay for. A client absorbing 28%
  of your time in unbilled calls needs a rate 39% above your floor to reach it.
- **Fixed fees that ran long.** A $6,000 job quoted at 55 hours and delivered in
  96 is paying $63/h. The app names the requote figure.
- **Retainers that quietly doubled.** A retainer is a fixed fee with promised
  hours, so overrun shows up the same way — $3,200 for 20 hours looks like
  $160/h and pays $94/h at 34 hours.
- **Work that was finished and never invoiced.** Invoices are matched against
  earnings oldest-first, so the tail is genuinely unbilled work, with the age of
  the oldest piece.
- **Who is slow, and by how much.** Amount-weighted days-to-pay against the
  terms you agreed — 58 days on net 30 is 28 days of your money in their bank
  account.
- **Receivables aged from the due date**, and the line where a late payer stops
  being an admin problem and becomes a credit decision.
- **Concentration.** When 40% of a period's billings come from one client, it
  says so.

## The arithmetic

| | |
|---|---|
| earned, hourly | billable hours × rate |
| earned, fixed  | the fee recognised across the hours the job actually took |
| **effective rate** | earned ÷ **every** hour logged, billable or not |
| rate to quote | your floor × (all hours ÷ billable hours) |
| never invoiced | earnings, oldest first, minus everything invoiced so far |
| days to pay | amount-weighted mean of (paid − issued), last 12 months |

Your floor rate is the input everything is measured against: the number below
which work is not worth taking, with overheads, unpaid time and time off
already priced in. Set it under Clients → Settings.

## Running it

Open `index.html` in a browser. No build, no server, no dependencies, nothing
leaves the machine — it all lives in that browser's local storage.

It opens on a sample book (five clients, one quarter, made up) so the read has
something to say. The first hour or invoice you log clears it.
