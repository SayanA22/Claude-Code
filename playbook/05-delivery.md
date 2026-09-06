# Delivering without destroying your margin

## Audit delivery (half a day, tops)

1. Full scan, higher page budget: `--pages 25 --rate {your rate}`
2. **Manual pass** — the part they are actually paying for:
   - Tab through the entire site with the keyboard. Can you reach everything?
     Is focus ever trapped or invisible?
   - Turn on a screen reader (VoiceOver on macOS, NVDA free on Windows) and
     try the primary task: book, buy, contact.
   - Zoom to 200%. Does the layout survive?
   - Check that the alt text that *does* exist is meaningful, not `image1.jpg`.
3. Add manual findings to the report as a section.
4. Deliver as PDF, with a 30-minute walkthrough call.

Automated testing covers roughly a third of WCAG success criteria. Say this
explicitly in every audit. It sets honest expectations and it justifies why the
manual pass has value.

## Remediation delivery

Fix in this order — it matches how you quoted and how risk actually falls:

1. Critical, on high-traffic pages
2. Critical, everywhere else
3. Serious, on high-traffic pages
4. Serious, everywhere else
5. Moderate and minor, if in scope

Re-scan after each batch:

```bash
node bin/audit.js scan https://client.com --pages 25 --out reports/client-after
```

Then put the before-and-after scores side by side. A score moving 34 → 91 is
the single most persuasive thing you will ever show a client. It renews
retainers, and it is your case study for the next ten prospects.

## The things that eat your margin

**Third-party embeds.** Booking widgets, maps, chat, payment iframes, review
badges. You usually cannot fix these. Exclude them in writing at quote time and
offer to raise them with the vendor as a separate line item.

**Scope creep dressed as a favour.** "While you're in there, could you…" is how
a $3,500 job becomes a $3,500 job that took three weeks. Answer warmly and
firmly: "Happy to — I'll add it as a small change order."

**CMS and template constraints.** Some fixes need theme-level changes on
Wordpress, Squarespace, Wix. Check the platform *before* quoting. Some
platforms simply will not let you fix certain things, and you need to know that
before you promise it.

**Endless review cycles.** Define in the contract: two rounds of revisions,
then change orders.

## Monitoring retainer (the compounding part)

Monthly, largely automated:

```bash
node bin/audit.js batch clients.csv --brand "Your Agency" --pages 20 --out reports/$(date +%Y-%m)
```

Send each client their score trend and anything new. Include a small fix
budget — two hours or so — in the retainer, which handles most regressions and
makes the value obvious.

Set a calendar reminder. A retainer you forget to deliver is a retainer that
gets cancelled.

## Subcontracting

If you cannot write the code, sell the audit and subcontract the remediation.
Pay a developer $60–90/hour, bill $150–200. Your value is the finding, the
prioritisation, the client relationship, and the verification — that is real
work and it is worth real margin.

Do not pretend to do the fixes yourself. If the client asks, tell them you work
with a developer. Nobody minds; everybody minds being misled.
