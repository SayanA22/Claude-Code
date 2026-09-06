# PR Radar

A personal dashboard for the pull requests that are actually waiting on **you**.

GitHub can already list your pull requests. What it won't tell you is which ones
are your problem right now. PR Radar answers that: it pulls your open PRs and the
ones awaiting your review, works out who each one is blocked on, and sorts the
whole pile so the top of the page is your to-do list.

```
Needs you  (4)              ← blocked on your action: conflicts, red CI, changes requested, approvals ready to merge
Your review requested (2)   ← other people's work waiting on your eyes
Your open PRs (4)           ← everything you have in flight
```

## Quickstart

Requires **Node 22.5 or newer** (it uses the built-in `node:sqlite` module, so
there is no database to install and nothing to compile).

```bash
npm install
cp .env.example .env      # then paste in a GitHub token
npm run dev               # → http://localhost:5173
```

For the token, create one at <https://github.com/settings/tokens>:

- **Classic token** — needs the `repo` scope (add `read:org` for organisation repos)
- **Fine-grained token** — needs Pull requests: Read, Contents: Read, Metadata: Read

Check the token works without starting anything:

```bash
npm run sync
```

## How the triage works

Every PR gets one headline verdict. The first rule that matches wins, so the
badge you see is the most urgent true thing about that PR.

**Your own PRs**

| Condition | Verdict | Blocked on |
| --- | --- | --- |
| Draft | Draft | nobody |
| Merge conflict | Merge conflict | **you** |
| CI failing or errored | CI failing | **you** |
| Changes requested | Changes requested | **you** |
| Approved and CI not pending | Ready to merge | **you** |
| CI still running | CI running | nobody |
| Otherwise | Awaiting review | them |

**PRs awaiting your review** are always on you, unless they are drafts.

Two things then adjust the ordering:

- **Staleness.** A PR with no activity for `STALE_AFTER_DAYS` (default 7) gets
  bumped up, even when it's technically waiting on someone else — that's the one
  you need to go chase.
- **Newness.** PRs first seen since your last visit get a `new` badge. This is
  why the app keeps a database rather than just proxying the GitHub API.

The rules live in [`server/src/triage.js`](server/src/triage.js), which is pure
and dependency-free. If you disagree with a call, that's the file to edit — and
`npm test` will tell you what you broke.

## Configuration

All optional except the token. See [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | *required* | GitHub personal access token |
| `PORT` | `4000` | API server port |
| `SYNC_INTERVAL_MINUTES` | `5` | How often to refresh from GitHub |
| `STALE_AFTER_DAYS` | `7` | Idle days before a PR is flagged stale |
| `REPO_FILTER` | *(all)* | Comma-separated `owner/repo` allowlist |
| `DB_PATH` | `./data/radar.db` | Where the SQLite file lives |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + Vite dev server together, with hot reload |
| `npm start` | Build the UI and serve everything from the API server |
| `npm test` | Run the triage test suite |
| `npm run sync` | One-shot sync from the terminal |
| `npm run server` | API only, no frontend build |

## How it fits together

```
web/          React + Vite. Renders three sections; polls /api/state.
  └─ dev server proxies /api → the Node server, so paths match in production

server/
  ├─ github.js   One GraphQL query for everything (~2 rate-limit points/sync
  │              out of 5000/hour, versus dozens of REST calls)
  ├─ triage.js   Pure decision logic: who is this blocked on, how urgent
  ├─ db.js       node:sqlite. Preserves first_seen_at across syncs, which is
  │              what makes the "new" badge possible
  ├─ sync.js     Polls on a timer; concurrent callers share one request
  └─ index.js    Express API, and serves the built UI in production
```

The database is a cache, not a source of truth: every sync replaces the PR set
wholesale, so merged and closed PRs disappear on their own. A failed sync leaves
the last good data in place and surfaces the error in the UI rather than showing
you an empty dashboard.

## Notes

- **Everything stays local.** Your token lives in `.env`, the data lives in a
  SQLite file in `data/`. Both are gitignored. Nothing is sent anywhere except
  GitHub.
- **Press `r`** to refresh without reaching for the mouse.
- **Rate limits are a non-issue.** At the default 5-minute interval this uses
  roughly 24 of your 5000 hourly GraphQL points.
