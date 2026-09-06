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
  demoMode: process.env.DEMO_MODE === "1",
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
 * Returns { problems, warnings }: problems stop startup, warnings are printed.
 */
export function validateConfig() {
  const problems = [];
  const warnings = [];

  if (config.demoMode) {
    // Demo mode never talks to GitHub, so a token is irrelevant.
    warnings.push("DEMO_MODE=1 -- serving sample data, not talking to GitHub.");
  } else if (!config.token) {
    problems.push(
      "GITHUB_TOKEN is not set. Copy .env.example to .env and add a token from https://github.com/settings/tokens",
    );
  } else if (!/^(gh[pousr]_|github_pat_)/.test(config.token)) {
    // Only a warning, never a hard stop. Personal tokens have these prefixes,
    // but GitHub App installation tokens, Enterprise Server tokens, and tokens
    // supplied by a proxy or credential helper legitimately do not. GitHub
    // itself is the authority on whether a token works; refusing to start over
    // a prefix guess locks out valid setups.
    warnings.push(
      "GITHUB_TOKEN does not match the usual personal-token prefixes (ghp_, gho_, ghu_, ghs_, ghr_, github_pat_). Continuing anyway -- if it is rejected, GitHub will say so.",
    );
  }

  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    problems.push(
      `Node ${process.versions.node} is too old. PR Radar uses the built-in node:sqlite module, which needs Node 22.5 or newer.`,
    );
  }

  return { problems, warnings };
}
