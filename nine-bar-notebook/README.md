# Nine Bar Notebook

An espresso dial-in log that tells you which way to turn the grinder.

Home espresso people already keep shot notes — in Notes.app, on a whiteboard, in
their head. The notes are the easy part. The hard part is the read: *this shot ran
24s and tasted sour, so what do I change, and by how much?* Nine Bar Notebook does
that read on every shot you log.

## What it does

- **Names the next move in your grinder's own numbers.** Not "grind finer" —
  "grind finer, one step, 3.9 → 3.4", computed from your grinder's step size and
  which direction its dial calls finer.
- **Catches the cases where grind is the wrong lever.** Slow *and* sour, or fast
  *and* bitter, is channeling — the app tells you to fix puck prep and hold the
  grinder, instead of chasing a number that isn't the problem.
- **Watches the things that quietly ruin a dial-in:** flow past ~2.2 g/s, a dose
  that drifted more than 0.4 g between shots, beans that are 3 days off roast and
  still degassing, or 30 days off and simply done.
- **Plots the trace.** Extraction time per shot against the target window, grind
  setting under each point, so convergence is visible instead of remembered.
- **Keeps a reference recipe per bag** and a rest-window gauge per bean.
- Ristretto / classic / lungo targets, brew-temp suggestions as the fine lever
  once time is in the window, and a copy-paste backup.

## Running it

Open `index.html` in a browser. No build, no server, no dependencies. Everything
is stored in that browser's local storage — nothing is uploaded.

The app opens on sample data (one bag, four shots, mid dial-in) so the coach has
something to read; the first shot you log clears it.
