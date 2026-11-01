# How to share Scam Spotter

There are three ways, from quickest to most official.

## Option 1: Send the zip file (works today, free)

1. Send `dist/scam-spotter-1.0.0.zip` to your friend or family member (email, USB stick, Google Drive).
2. Ask them to follow the steps below.

### Install steps for the person you're sending it to

1. **Unzip** the file. Right-click it, then choose **Extract All**.
2. Open Chrome (or Edge) and go to `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right in Chrome, left sidebar in Edge).
4. Click **Load unpacked** and choose the unzipped folder, the one with `manifest.json` inside.
5. Click the puzzle-piece icon in the toolbar and **pin** Scam Spotter.
6. To use it: highlight text or right-click a link, then choose **Is this a scam?**. Or click the icon, paste, and press **Check**.

Heads-up for them: Chrome may show a "developer mode extensions" reminder when it starts. That is normal for this method and goes away with Option 3.

**Keep the unzipped folder.** If they delete it, the extension stops working.

## Option 2: Share the GitHub page (free)

1. Merge the `claude/scam-detector-extension-wy5wib` branch into `main` so the code is on the main page.
2. On GitHub, open **Releases → Draft a new release**, tag it `v1.0.0`, and attach `dist/scam-spotter-1.0.0.zip`.
3. Share the release link. People download the zip and use the install steps above.

## Option 3: Publish on the Chrome Web Store (best for non-technical people)

People install with one click and get automatic updates. No developer-mode warning.

1. Create a developer account at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). There is a **one-time $5 registration fee**.
2. Click **New item** and upload `dist/scam-spotter-1.0.0.zip`.
3. Fill in the listing using the text in `STORE_LISTING.md`.
4. Add screenshots from the `store/` folder.
5. For the privacy policy, you need a web address. The easiest way is to link to `PRIVACY.md` on GitHub once it is on the `main` branch.
6. Answer the privacy questions. The honest answers are: no data collected, no remote code, and the single purpose is "check messages and links for scam warning signs".
7. Submit for review. Reviews usually take a few days.

**Microsoft Edge Add-ons** is free to join and uses the same zip: <https://partner.microsoft.com/dashboard/microsoftedge>

## Option 4: The web version (works on phones, free)

Many scams arrive as texts on a phone, and phone Chrome cannot run extensions. `web/index.html` is a version that runs in any browser on any device. It uses the same `rules.js`, so it always gives the same answers as the extension.

To put it online for free with GitHub Pages (after the branch is merged into `main`):

1. On GitHub, open the repo, then **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and the `/ (root)` folder, and press **Save**.
3. After a minute, your page is live at `https://sayana22.github.io/Claude-Code/web/`.
4. Share that link or turn it into a QR code. On a phone, people can use **Share → Add to Home Screen** to get an icon.

Nothing is sent anywhere: the page makes no network requests after it loads.

## Before you share widely

- Test with a few real older adults and a few of your own spam emails.
- Remember the tool is a second opinion. The store description says so, and you should too.
- Put a contact email in the store listing so people can report scams it missed.

## Making a new zip after you change something

Zip the extension files, not the `tests`, `store`, or `dist` folders.

**Windows (PowerShell), from the project folder:**
```
Compress-Archive -Force -DestinationPath dist\scam-spotter-1.0.0.zip -Path manifest.json,rules.js,background.js,popup.html,popup.js,results.html,results.js,ui.js,styles.css,icons
```

**Mac / Linux:**
```
zip -r dist/scam-spotter-1.0.0.zip manifest.json rules.js background.js popup.html popup.js results.html results.js ui.js styles.css icons
```

If you publish an update to the store, raise `"version"` in `manifest.json` first (for example to `1.0.1`).
