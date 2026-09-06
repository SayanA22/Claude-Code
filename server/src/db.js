import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { config } from "./config.js";

let db;

/**
 * Open (and if needed create) the database. Safe to call more than once.
 */
export function openDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      id               TEXT PRIMARY KEY,
      repo             TEXT NOT NULL,
      number           INTEGER NOT NULL,
      title            TEXT NOT NULL,
      url              TEXT NOT NULL,
      author           TEXT NOT NULL,
      author_avatar    TEXT,
      is_draft         INTEGER NOT NULL DEFAULT 0,
      is_mine          INTEGER NOT NULL DEFAULT 0,
      needs_my_review  INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      review_decision  TEXT,
      mergeable        TEXT,
      ci_state         TEXT,
      additions        INTEGER NOT NULL DEFAULT 0,
      deletions        INTEGER NOT NULL DEFAULT 0,
      changed_files    INTEGER NOT NULL DEFAULT 0,
      comment_count    INTEGER NOT NULL DEFAULT 0,
      first_seen_at    TEXT NOT NULL,
      last_synced_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pr_updated ON pull_requests (updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pr_buckets ON pull_requests (is_mine, needs_my_review);

    CREATE TABLE IF NOT EXISTS sync_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at   TEXT NOT NULL,
      finished_at  TEXT,
      ok           INTEGER NOT NULL DEFAULT 0,
      pr_count     INTEGER NOT NULL DEFAULT 0,
      error        TEXT
    );

    CREATE TABLE IF NOT EXISTS meta (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );
  `);
}

export function getMeta(key, fallback = null) {
  const row = openDb().prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setMeta(key, value) {
  openDb()
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, String(value));
}

/**
 * Replace the stored PR set with a freshly synced one.
 *
 * first_seen_at is preserved for PRs we already knew about, which is what
 * powers the "new since you last looked" badge in the UI. Anything absent
 * from the new set is deleted: it merged, closed, or stopped being ours.
 */
export function replacePullRequests(pullRequests, syncedAt) {
  const database = openDb();
  const existing = new Map(
    database
      .prepare("SELECT id, first_seen_at FROM pull_requests")
      .all()
      .map((row) => [row.id, row.first_seen_at]),
  );

  const upsert = database.prepare(`
    INSERT INTO pull_requests (
      id, repo, number, title, url, author, author_avatar, is_draft, is_mine,
      needs_my_review, created_at, updated_at, review_decision, mergeable,
      ci_state, additions, deletions, changed_files, comment_count,
      first_seen_at, last_synced_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      repo = excluded.repo,
      title = excluded.title,
      url = excluded.url,
      author = excluded.author,
      author_avatar = excluded.author_avatar,
      is_draft = excluded.is_draft,
      is_mine = excluded.is_mine,
      needs_my_review = excluded.needs_my_review,
      updated_at = excluded.updated_at,
      review_decision = excluded.review_decision,
      mergeable = excluded.mergeable,
      ci_state = excluded.ci_state,
      additions = excluded.additions,
      deletions = excluded.deletions,
      changed_files = excluded.changed_files,
      comment_count = excluded.comment_count,
      last_synced_at = excluded.last_synced_at
  `);

  database.exec("BEGIN");
  try {
    for (const pr of pullRequests) {
      upsert.run(
        pr.id,
        pr.repo,
        pr.number,
        pr.title,
        pr.url,
        pr.author,
        pr.authorAvatar,
        pr.isDraft ? 1 : 0,
        pr.isMine ? 1 : 0,
        pr.needsMyReview ? 1 : 0,
        pr.createdAt,
        pr.updatedAt,
        pr.reviewDecision,
        pr.mergeable,
        pr.ciState,
        pr.additions,
        pr.deletions,
        pr.changedFiles,
        pr.commentCount,
        existing.get(pr.id) ?? syncedAt,
        syncedAt,
      );
    }
    database
      .prepare("DELETE FROM pull_requests WHERE last_synced_at != ?")
      .run(syncedAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function allPullRequests() {
  return openDb()
    .prepare("SELECT * FROM pull_requests ORDER BY updated_at DESC")
    .all();
}

export function startSyncRun(startedAt) {
  const result = openDb()
    .prepare("INSERT INTO sync_runs (started_at) VALUES (?)")
    .run(startedAt);
  return Number(result.lastInsertRowid);
}

export function finishSyncRun(id, { ok, prCount = 0, error = null }) {
  openDb()
    .prepare(
      "UPDATE sync_runs SET finished_at = ?, ok = ?, pr_count = ?, error = ? WHERE id = ?",
    )
    .run(new Date().toISOString(), ok ? 1 : 0, prCount, error, id);
}

export function lastSuccessfulSyncRun() {
  return (
    openDb()
      .prepare("SELECT * FROM sync_runs WHERE ok = 1 ORDER BY id DESC LIMIT 1")
      .get() ?? null
  );
}

export function lastSyncRun() {
  return (
    openDb()
      .prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1")
      .get() ?? null
  );
}
