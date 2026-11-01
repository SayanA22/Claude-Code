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
| `popup.html` / `popup.js` | The window that opens from the toolbar icon. |
| `results.html` / `results.js` | The window opened by the right-click menu. |
| `ui.js` | Draws a result on screen (shared by both windows). |
| `styles.css` | Navy and white look with a dark mode. Big text, high contrast, large buttons. Colors are named "slots" at the top, so they are easy to change. |
| `icons/` | Toolbar and store icons. |
| `tests/run-tests.js` | Example messages and links with their expected results. |
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
- **1–2 medium** flags → 🟡 Be careful
- Nothing found → 🟢 Looks okay

Each *kind* of flag counts once, so five shortened links is still one "shortened link" flag.

## How to add a new red flag

**A new message rule** (something in the text). Open `rules.js`, find `MESSAGE_FLAGS`, and add an entry:

```js
{
  id: "romance",                      // short unique name
  level: "high",                      // "high" or "medium"
  text: "Someone you've never met in person is asking for money.",  // shown to the user
  test: function (t) {                // t is the message in lowercase
    return /i love you/.test(t) && /\b(send|wire|pay)\b/.test(t);
  }
},
```

Then add an example to `tests/run-tests.js` and run the tests.

**A new brand to protect** (for look-alike and fake-site checks): add a line to `BRANDS` in `rules.js` with its name, the lowercase word in its address, and its real domains.

**A new link shortener or unusual ending:** add it to `SHORTENERS` or `UNUSUAL_TLDS`.

## Known limitations (Version 1)

- It is a set of keyword rules, so it can be fooled by new wording and can sometimes be wrong. Treat it as a second opinion, not a guarantee.
- "Don't tell anyone" in an innocent message (like a surprise party) will be flagged.
- English only.
