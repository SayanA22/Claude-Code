import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..", "..");

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  token: process.env.GITHUB_TOKEN?.trim() ?? "",
  port: int(process.env.PORT, 4000),
  syncIntervalMinutes: int(process.env.SYNC_INTERVAL_MINUTES, 5),
  staleAfterDays: int(process.env.STALE_AFTER_DAYS, 7),
  dbPath: process.env.DB_PATH?.trim() || path.join(ROOT, "data", "radar.db"),
  repoFilter: (process.env.REPO_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  webDist: path.join(ROOT, "web", "dist"),
};

/**
 * Fail loudly and usefully at boot rather than with a 401 twenty minutes later.
 * Returns a list of human-readable problems; empty means good to go.
 */
export function validateConfig() {
  const problems = [];
  if (!config.token) {
    problems.push(
      "GITHUB_TOKEN is not set. Copy .env.example to .env and add a token from https://github.com/settings/tokens",
    );
  } else if (!/^(gh[pousr]_|github_pat_)/.test(config.token)) {
    problems.push(
      "GITHUB_TOKEN does not look like a GitHub token (expected it to start with ghp_, gho_, ghu_, ghs_, ghr_, or github_pat_).",
    );
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    problems.push(
      `Node ${process.versions.node} is too old. PR Radar uses the built-in node:sqlite module, which needs Node 22.5 or newer.`,
    );
  }
  return problems;
}
