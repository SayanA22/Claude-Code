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
This repo is set up to deploy to **GitHub Pages** (frontend) + **Render**
(notification server) — see [Deploying](#deploying-github-pages--render)
below.

## Installing as a mobile app

1. Open the deployed HTTPS URL in your phone's browser.
2. **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.
   **Android (Chrome):** tap the menu (⋮) → **Add to Home screen** / **Install app**,
   or use the **Install App** button on the Setup tab.
3. Launch it from your home screen — it opens full-screen, like a native app.

## Deploying: GitHub Pages + Render

### 1. Frontend on GitHub Pages

1. On GitHub, go to this repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: select this branch (or `main`, once merged) · Folder: **/ (root)**.
4. Save. GitHub gives you a URL like `https://<your-username>.github.io/<repo>/`
   within a minute or two — that's your app's install URL.

The repo already includes `.nojekyll` so GitHub Pages serves the files
as-is (no Jekyll processing).

### 2. Notification server on Render

1. Generate your own VAPID keys locally (don't reuse anyone else's):
   ```bash
   cd server && npm install && npm run generate-vapid-keys
   ```
   Copy the `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` it prints — you'll paste
   them into Render, never into the repo.
2. On [render.com](https://render.com), sign up/log in, then **New → Blueprint**.
3. Connect your GitHub account and select this repository. Render detects the
   included `render.yaml` and proposes a **mile-trainer-notify** web service
   (free plan, root dir `server`, build `npm install`, start `npm start`).
4. When prompted for environment variables, paste in:
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — from step 1
   - `VAPID_SUBJECT` — `mailto:you@example.com` (any contact email)
   - `ALLOWED_ORIGIN` — your GitHub Pages URL from part 1 (or leave `*`)
5. Deploy. Render gives you a URL like
   `https://mile-trainer-notify.onrender.com`.
6. **Free-tier caveat:** Render's free web services spin down after ~15
   minutes with no incoming requests, which would stop the internal
   once-a-minute reminder check. Keep it awake for free with an uptime
   pinger — e.g. [UptimeRobot](https://uptimerobot.com) or
   [cron-job.org](https://cron-job.org), hitting
   `https://mile-trainer-notify.onrender.com/healthz` every 5–10 minutes.
   (Or upgrade to Render's paid Starter plan for an always-on instance.)

### 3. Connect the app to the server

1. Open your GitHub Pages URL on your phone.
2. Install it to your Home Screen (see below).
3. In the **Setup** tab → **Workout Reminders**, enter your Render URL
   (e.g. `https://mile-trainer-notify.onrender.com`) and a daily reminder
   time, then tap **Enable Reminders** and grant notification permission.

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
- `.nojekyll` — tells GitHub Pages to serve files as-is
- `render.yaml` — Render Blueprint for one-click backend deployment
- `server/` — optional Node/Express push-notification backend
  - `server.js` — subscription storage + daily reminder scheduler
  - `generate-vapid-keys.js` — one-time VAPID key generation
