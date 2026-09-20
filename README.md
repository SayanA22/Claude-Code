# Mile Trainer

A installable **PWA (Progressive Web App)** to help you go from a **5:00 mile
to a 4:40 mile in 16 weeks (~4 months)** — with an app icon on your home
screen, offline support, and daily workout push notifications.

No build step, no framework — just static files. The core app has no
backend and stores everything locally via `localStorage`; push notifications
use a small optional server in `server/`.

## Features

- **Dashboard** — days remaining, current best time, gap to goal, current
  training phase, and this week's workouts (with checkboxes).
- **Training Plan** — a full week-by-week plan, auto-generated from your start
  date/time and goal date/time. Training paces (easy, tempo, 400m/800m/200m
  repeats) progress each week along a linear "glide path" from your current
  mile fitness to your goal, moving through five phases:
  1. **Base Building** — aerobic mileage, strides, hill sprints
  2. **Aerobic Power** — 400m repeats, tempo runs
  3. **Threshold & VO2max** — 800m and 200m repeats, tempo-finish long runs
  4. **Race-Pace Sharpening** — goal-pace intervals, speed work
  5. **Taper & Time Trial** — sharpen and race the mile
- **Log** — record mile time trials and workout notes (with perceived effort).
- **Progress** — a chart of logged time trials vs. the goal glide-path, plus
  an on-track/behind/ahead status for the current week.
- **Pace Calculator** — enter any recent race/time-trial result (400m, 800m,
  mile, 5K) and get an estimated equivalent mile time (Riegel formula) along
  with training paces at both your current and goal fitness levels.
- **Setup** — edit your start/goal dates and times at any time; the plan
  regenerates while your logged history is preserved.
- **Install as an app** — installable to your home screen on iPhone and
  Android (PWA), works offline once installed.
- **Push notifications** — a daily reminder naming that day's scheduled
  workout, delivered even when the app isn't open.

## Usage (web app)

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Or just open `index.html` directly in a browser.

On first load, defaults are a 16-week plan starting today, going from 5:00 to
4:40. Adjust these in the **Setup** tab to match your actual timeline.

**Important:** service workers (needed for installability + notifications)
require HTTPS in production — `localhost` is exempted for local testing.
Deploy the static files (`index.html`, `styles.css`, `app.js`,
`planLogic.js`, `sw.js`, `manifest.webmanifest`, `icons/`) to any static host
that serves HTTPS (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc).

## Installing as a mobile app

1. Open the deployed HTTPS URL in your phone's browser.
2. **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.
   **Android (Chrome):** tap the menu (⋮) → **Add to Home screen** / **Install app**,
   or use the **Install App** button on the Setup tab.
3. Launch it from your home screen — it opens full-screen, like a native app.

## Setting up workout reminder notifications

True push notifications (delivered even when the app is closed) require a
server that can wake your phone's push service on a schedule — that's what
`server/` is for. It's a small Node/Express service; you run or deploy it
once, then point the app at its URL.

```bash
cd server
npm install
npm run generate-vapid-keys        # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

Create `server/.env` with the keys it printed:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
PORT=3001
```

Then run it:

```bash
npm start
```

Deploy this anywhere that can run a persistent Node process (Render, Fly.io,
Railway, a small VPS, etc — it needs to stay running to check the schedule
every minute). It stores subscriptions in `server/data/subscriptions.json`
(gitignored) — no database needed for personal use.

In the app's **Setup** tab, under **Workout Reminders**, enter your deployed
server's URL and a daily reminder time, then tap **Enable Reminders**. Grant
notification permission when prompted.

**Platform notes:**
- **Android (Chrome):** works after installing the PWA, and often even
  without installing.
- **iPhone (Safari):** requires iOS 16.4+ **and** the app must first be
  installed to your Home Screen (see above) — Safari does not support push
  notifications for sites opened only in a browser tab.

## Files

- `index.html` — app shell/markup
- `styles.css` — styling
- `planLogic.js` — pure plan-generation/pace math, shared by the browser app
  and the notification server
- `app.js` — state, rendering, logging, PWA install + push subscription logic
- `sw.js` — service worker: offline caching + push/notificationclick handling
- `manifest.webmanifest` — PWA metadata (name, icons, display mode)
- `icons/` — app icons
- `server/` — optional Node/Express push-notification backend
  - `server.js` — subscription storage + daily reminder scheduler
  - `generate-vapid-keys.js` — one-time VAPID key generation
