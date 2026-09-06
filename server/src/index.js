import fs from "node:fs";
import path from "node:path";

import express from "express";

import { config, validateConfig } from "./config.js";
import {
  allPullRequests,
  getMeta,
  lastSuccessfulSyncRun,
  lastSyncRun,
  openDb,
  setMeta,
} from "./db.js";
import { buildSections } from "./triage.js";
import { startPolling, sync } from "./sync.js";

const { problems, warnings } = validateConfig();
if (problems.length > 0) {
  console.error("\nPR Radar cannot start:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("");
  process.exit(1);
}
for (const warning of warnings) console.warn(`  warning: ${warning}`);

openDb();

const app = express();
app.use(express.json());

function currentState() {
  const lastViewedAt = getMeta("last_viewed_at");
  const sections = buildSections(allPullRequests(), {
    staleAfterDays: config.staleAfterDays,
    lastViewedAt,
  });
  const run = lastSyncRun();
  const lastGood = lastSuccessfulSyncRun();
  return {
    viewer: {
      login: getMeta("viewer_login"),
      avatarUrl: getMeta("viewer_avatar"),
    },
    sync: run
      ? {
          startedAt: run.started_at,
          finishedAt: run.finished_at,
          ok: Boolean(run.ok),
          error: run.error,
          // Report the last sync that actually brought data back. Showing the
          // failed attempt's timestamp would claim the data is fresh when the
          // dashboard is in fact serving whatever it last managed to fetch.
          lastGoodAt: lastGood?.finished_at ?? null,
          prCount: lastGood?.pr_count ?? 0,
        }
      : null,
    rateLimitRemaining: getMeta("rate_limit_remaining"),
    settings: {
      staleAfterDays: config.staleAfterDays,
      syncIntervalMinutes: config.syncIntervalMinutes,
      repoFilter: config.repoFilter,
    },
    lastViewedAt,
    counts: {
      attention: sections.attention.length,
      needsReview: sections.needsReview.length,
      mine: sections.mine.length,
    },
    sections,
  };
}

app.get("/api/state", (_req, res) => {
  res.json(currentState());
});

app.post("/api/sync", async (_req, res) => {
  const result = await sync();
  res.status(result.ok ? 200 : 502).json({ ...result, state: currentState() });
});

// Called when the dashboard regains focus, so "new" badges clear once seen.
app.post("/api/seen", (_req, res) => {
  setMeta("last_viewed_at", new Date().toISOString());
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  const run = lastSyncRun();
  res.json({
    ok: true,
    node: process.versions.node,
    lastSyncOk: run ? Boolean(run.ok) : null,
    lastSyncAt: run?.finished_at ?? null,
  });
});

// Serve the built frontend when it exists. In development the Vite dev server
// handles the UI and proxies /api here, so a missing dist/ is expected.
if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(config.webDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("text/plain")
      .send(
        "PR Radar API is running, but the frontend has not been built.\n\n" +
          "Development:  npm run dev    (then open the Vite URL it prints)\n" +
          "Production:   npm start      (builds the UI, then serves it here)\n",
      );
  });
}

app.listen(config.port, () => {
  console.log(`\n  PR Radar → http://localhost:${config.port}`);
  console.log(
    `  Syncing every ${config.syncIntervalMinutes} min · stale after ${config.staleAfterDays} days\n`,
  );
  startPolling();
});
