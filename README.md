# Scam Spotter

A free Chrome extension that helps older adults spot online scams.

Paste a suspicious message or link (or right-click one) and get a big, plain-English answer:

- 🔴 **Likely scam**
- 🟡 **Be careful**
- 🟢 **Looks okay** (we never say "safe", because nothing can promise that)

Every answer lists *why*, one short sentence per red flag, and ends with:
**"When in doubt, ask a family member before clicking or paying."**

## How to use it

- **Toolbar:** click the extension icon, paste the message or link, press **Check**.
- **Right-click:** highlight text or right-click a link → **Is this a scam?** A small window opens with the answer.

## Privacy promise

**Nothing leaves your computer.**

- No network requests, no tracking, no accounts, no analytics.
- The only permission is `contextMenus` (to add the right-click item). There are no host permissions and no content scripts, so the extension can't read the pages you visit.
- All checking is done by `rules.js` on your own machine.

## Files

| File | What it does |
| --- | --- |
| `manifest.json` | Tells Chrome what the extension is and which permission it needs. |
| `rules.js` | **All the scam-detection logic.** Text in, result out. No browser code. |
| `background.js` | Adds the right-click menu item and opens the results window. |
| `popup.html` | The window that opens from the toolbar icon (a thin page that loads `app.js`). |
| `results.html` | The window opened by the right-click menu. Same thing, but it checks the text it was given straight away. |
| `app.js` | **The journey:** ask, read, answer. Runs the popup, the right-click window and the web version. |
| `ui.js` | The pieces of the screen: the owl, the highlighted message, the verdict, the meter and the reasons. |
| `fonts/` | The easy-to-read font (Atkinson Hyperlegible, open license), stored here so nothing is downloaded. |
| `styles.css` | Navy and white look with a dark mode. Big text, high contrast, large buttons. Colors are named "slots" at the top, so they are easy to change. |
| `icons/` | Toolbar and store icons. |
| `tests/run-tests.js` | Example messages and links with their expected results. |
| `web/index.html` | The web version for phones and any browser. Runs the same `rules.js`, `ui.js`, `app.js` and `styles.css`. |
| `PRIVACY.md` | The privacy policy (the Chrome Web Store requires one). |
| `STORE_LISTING.md` | Ready-to-paste text for the store listing. |
| `SHARING.md` | How to share it: zip file, GitHub release, or the Chrome Web Store. |
| `store/` | 1280 x 800 screenshots for the store listing. |
| `dist/` | The ready-to-share zip file. |

## Share it

See [`SHARING.md`](SHARING.md). The short version: send `dist/scam-spotter-1.0.0.zip` to someone, or publish it on the Chrome Web Store.

## Run the tests

You need [Node.js](https://nodejs.org). From this folder:

```
node tests/run-tests.js
```

## How scoring works

- Any **1 high** flag → 🔴 Likely scam
- **3 or more medium** flags → 🔴 Likely scam
- A **pushy message AND a suspicious link** together (for example "act now" plus a shortened link) → 🔴 Likely scam, even with only two medium flags
- **1–2 other medium** flags → 🟡 Be careful
- Nothing found → 🟢 Looks okay

Each *kind* of flag counts once, so five shortened links is still one "shortened link" flag.

## What it checks

**Links:** look-alike spellings (`amaz0n.com`, foreign letters like a Russian "а"), a real brand's name in a different site's address or in a login page's path, brand names hidden inside redirect links, shortened links, unusual endings and raw IP addresses, `http://` instead of `https://`, addresses stuffed with "secure/login/verify" words, and (from the right-click menu) a link whose words name one website while it really goes to another. It knows about about 80 commonly impersonated companies.

**Messages:** gift card / crypto / prepaid card / wire requests, fake virus and tech-support warnings, prize claims, government impersonation, requests for passwords or codes, secrecy, remote-access software, refund scams, urgency and threats, delivery fees, **and these scams that often target older adults:** "Grandma, I'm in trouble" family emergencies, "Hi Mom, this is my new number" texts, romance scams, check-deposit scams, "move your money to a safe account", couriers collecting cash, "don't hang up", unpaid toll and DMV texts, fake invoices and surprise charges with a number to call, fortunes from strangers, get-rich and easy-money offers, utility shut-off threats, "verify your account" links, QR-code tricks, and "wrong number" openers.

Every rule is tested against both scams and ordinary messages, so it should not cry wolf on normal texts.

## How to add a new red flag

**A new message rule** (something in the text). Open `rules.js`, find `MESSAGE_FLAGS`, and add an entry:

```js
{
  id: "romance",                      // short unique name
  level: "high",                      // "high" or "medium"
  text: "Someone you've never met in person is asking for money.",  // shown to the user
  test: function (t) {                // t is the message in lowercase
    return /i love you/.test(t) && /\b(send|wire|pay)\b/.test(t);
  },
  marks: [/i love you/]               // the phrases to highlight in the message (optional)
},
```

When the flag fires, the phrases in `marks` light up inside the person's message, and the reason gets a number that matches them. Then add an example to `tests/run-tests.js` and run the tests.

**A new brand to protect** (for look-alike and fake-site checks): add a line to `BRANDS` in `rules.js` with its name, the lowercase word in its address, and its real domains.

**A new link shortener or unusual ending:** add it to `SHORTENERS` or `UNUSUAL_TLDS`.

## Changing the name or the look

- **The name:** change `APP_NAME` at the top of `ui.js`, and `"name"` in `manifest.json`.
- **Colors:** they are named "slots" at the top of `styles.css` (a light set and a dark set). Change them there.
- **The owl:** it is drawn in code in `ui.js` (`owlMarkup`). It has five moods: idle, scan, scam, careful and okay.

## Known limitations (Version 1)

- It is a set of keyword rules, so it can be fooled by new wording and can sometimes be wrong. Treat it as a second opinion, not a guarantee.
- English only.
- It can't see pictures, hear calls, or know who really sent a message. A scam with brand-new wording can slip through, so keep teaching people the basics.
