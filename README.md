# Mile Trainer

A self-contained web app to help you go from a **5:00 mile to a 4:40 mile in 16 weeks (~4 months)**.

No build step, no dependencies, no backend — just open `index.html` in a browser
(or serve the folder with any static file server). All data is stored locally
in your browser via `localStorage`.

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

## Usage

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Or just open `index.html` directly in a browser.

On first load, defaults are a 16-week plan starting today, going from 5:00 to
4:40. Adjust these in the **Setup** tab to match your actual timeline.

## Files

- `index.html` — app shell/markup
- `styles.css` — styling
- `app.js` — plan generation, pace math, logging, and rendering logic
