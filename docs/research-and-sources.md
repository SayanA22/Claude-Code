# Research and sources

Every number used in the pitch, the app, and the strategy pack, with where it came from.
If a figure is not in this file, do not say it in the video.

## Market size and pain

| Claim | Figure | Source |
|---|---|---|
| Americans holding medical debt they cannot pay | more than 100 million (~41% of adults) | KFF Health News with NPR and CBS News, *Diagnosis: Debt* — <https://kffhealthnews.org/diagnosis-debt/> |
| Total US medical debt | at least $220 billion | Peterson-KFF Health System Tracker — <https://www.healthsystemtracker.org/brief/the-burden-of-medical-debt-in-the-united-states/> |
| Adults who could not pay an unexpected $500 medical bill | about half | KFF, *Americans' Challenges with Health Care Costs* — <https://www.kff.org/health-costs/americans-challenges-with-health-care-costs/> |
| Owing more than $1,000 in medical debt | ~14 million people (6% of adults) | KFF, as above |

## The incumbent's price

| Claim | Figure | Source |
|---|---|---|
| Billing advocate contingency fee | 25–35% of savings | Consumer Reports, *How to Get Help With Your Medical Bills* — <https://www.consumerreports.org/medical-billing/how-to-get-help-with-your-medical-bills/> |
| Billing advocate hourly rate | roughly $75–$350/hr | Same, corroborated across advocacy-industry sources |
| Flat fee for a single bill review or one appeal letter | roughly $300–$1,500 | Advocacy-industry pricing pages |

## The legal levers the engine encodes

| Rule | What it gives the patient | Source |
|---|---|---|
| **No Surprises Act** — PHS Act §2799B-1, §2799B-2 | Out-of-network clinicians cannot balance-bill for emergency care, or for ancillary services at an in-network facility. Liability is capped at in-network cost sharing. Complaints: 1-800-985-3059 | CFPB — <https://www.consumerfinance.gov/ask-cfpb/what-is-a-surprise-medical-bill-and-what-should-i-know-about-the-no-surprises-act-en-2123/> |
| **Good faith estimate** — 45 CFR 149.610 | Uninsured/self-pay patients are owed a written estimate. If the bill exceeds it by **more than $400**, they can open patient-provider dispute resolution within **120 days** for a **$25** fee, and collections must pause while it is pending | CMS — <https://www.cms.gov/marketplace/technical-assistance-resources/understanding-good-faith-estimate-and-dispute-resolution-process.pdf> |
| **Hospital Price Transparency Rule** — 45 CFR Part 180 | Since 2021 every hospital must publish a machine-readable file of its standard charges, including a discounted cash price. This is what makes a price argument concrete | CMS hospital price transparency guidance |
| **ACA preventive services** — PHS Act §2713 | USPSTF grade A/B screenings must be covered with no cost sharing in network | Statute |
| **NCCI edits / MUE** | CMS's own correct-coding rules: which codes may not be billed together, and the maximum plausible units per code per day | CMS National Correct Coding Initiative, published quarterly |

## Benchmark methodology

- Commercial plans pay roughly **254% of Medicare** on average for hospital services
  (RAND hospital price transparency studies). The app therefore treats **2.5× Medicare**
  as a defensible target price and only surfaces a line once it exceeds **4× Medicare**,
  so it does not cry wolf.
- Medicare reference rates in the prototype are **rounded national averages for a
  demonstration set of codes**, and are labelled as such in the app. Production reads the
  live CMS fee schedules. Do not present them in the video as exact.

## A number this entry deliberately does not use

The widely quoted claim that **"up to 80% of hospital bills contain errors"** traces to a
billing-advocacy trade association, not to peer-reviewed work, and is disputed. It is
tempting and it is everywhere. Leave it out — a judge who knows the literature will mark
you down for it, and the case does not need it. The documented facts (debt scale, price
dispersion, unexercised legal rights) are enough.
