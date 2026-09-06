import { config } from "./config.js";
import {
  finishSyncRun,
  replacePullRequests,
  setMeta,
  startSyncRun,
} from "./db.js";
import { DEMO_PULL_REQUESTS } from "./demo-data.js";
import { fetchDashboard } from "./github.js";

let inFlight = null;

/**
 * Pull fresh data from GitHub and store it.
 *
 * Concurrent callers share one request: the interval timer and someone
 * mashing the refresh button should not produce two round trips.
 */
export function sync() {
  if (inFlight) return inFlight;
  inFlight = runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync() {
  const startedAt = new Date().toISOString();
  const runId = startSyncRun(startedAt);
  try {
    const { viewer, pullRequests, rateLimit } = config.demoMode
      ? {
          viewer: { login: "demo-user", avatarUrl: null },
          pullRequests: DEMO_PULL_REQUESTS,
          rateLimit: null,
        }
      : await fetchDashboard();
    replacePullRequests(pullRequests, startedAt);
    setMeta("viewer_login", viewer.login);
    if (viewer.avatarUrl) setMeta("viewer_avatar", viewer.avatarUrl);
    if (rateLimit) setMeta("rate_limit_remaining", rateLimit.remaining);
    finishSyncRun(runId, { ok: true, prCount: pullRequests.length });
    return { ok: true, count: pullRequests.length };
  } catch (error) {
    // Join the API's message and our hint into one readable sentence pair;
    // GitHub's messages do not come with trailing punctuation.
    const stem = /[.!?]$/.test(error.message) ? error.message : `${error.message}.`;
    const message = error.hint ? `${stem} ${error.hint}` : stem;
    finishSyncRun(runId, { ok: false, error: message });
    return { ok: false, error: message };
  }
}

/**
 * Sync now, then on a timer. Returns a stop function.
 * unref() keeps the timer from holding the process open on its own.
 */
export function startPolling() {
  const intervalMs = config.syncIntervalMinutes * 60 * 1000;
  sync().then((result) => {
    if (!result.ok) console.error(`[sync] initial sync failed: ${result.error}`);
  });
  const timer = setInterval(() => {
    sync().then((result) => {
      if (!result.ok) console.error(`[sync] failed: ${result.error}`);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
