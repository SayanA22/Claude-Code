import assert from "node:assert/strict";
import { test } from "node:test";

import { BLOCKED_ON, buildSections, daysSince, triage } from "../src/triage.js";

const NOW = Date.parse("2026-09-06T12:00:00Z");

function pr(overrides = {}) {
  return {
    id: "PR_1",
    repo: "acme/api",
    number: 1,
    title: "Add thing",
    is_draft: 0,
    is_mine: 1,
    needs_my_review: 0,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-06T11:00:00Z",
    review_decision: null,
    mergeable: "MERGEABLE",
    ci_state: "SUCCESS",
    first_seen_at: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

test("daysSince measures elapsed days and never goes negative", () => {
  assert.equal(Math.floor(daysSince("2026-09-01T12:00:00Z", NOW)), 5);
  assert.equal(daysSince("2026-09-30T12:00:00Z", NOW), 0);
  assert.equal(daysSince("not a date", NOW), 0);
});

test("a merge conflict is the most urgent thing and is on you", () => {
  const result = triage(pr({ mergeable: "CONFLICTING" }), { now: NOW });
  assert.equal(result.blockedOn, BLOCKED_ON.YOU);
  assert.equal(result.reason, "Merge conflict");
  assert.equal(result.severity, 4);
});

test("failing CI outranks an approval", () => {
  const result = triage(
    pr({ ci_state: "FAILURE", review_decision: "APPROVED" }),
    { now: NOW },
  );
  assert.equal(result.reason, "CI failing");
  assert.equal(result.blockedOn, BLOCKED_ON.YOU);
});

test("an approved green PR is yours to merge", () => {
  const result = triage(pr({ review_decision: "APPROVED" }), { now: NOW });
  assert.equal(result.reason, "Ready to merge");
  assert.equal(result.blockedOn, BLOCKED_ON.YOU);
});

test("a healthy PR awaiting review is blocked on them, not you", () => {
  const result = triage(pr({ review_decision: "REVIEW_REQUIRED" }), { now: NOW });
  assert.equal(result.blockedOn, BLOCKED_ON.THEM);
  assert.equal(result.reason, "Awaiting review");
});

test("drafts are nobody's problem and sort last", () => {
  const result = triage(pr({ is_draft: 1, ci_state: "FAILURE" }), { now: NOW });
  assert.equal(result.blockedOn, BLOCKED_ON.NOBODY);
  assert.equal(result.severity, 0);
  assert.equal(result.isStale, false, "drafts are never flagged stale");
});

test("a review request is always on you", () => {
  const result = triage(
    pr({ is_mine: 0, needs_my_review: 1, author: "someone" }),
    { now: NOW },
  );
  assert.equal(result.blockedOn, BLOCKED_ON.YOU);
  assert.equal(result.reason, "Your review requested");
});

test("staleness lifts a low-priority PR so it does not sink", () => {
  const fresh = triage(pr({ review_decision: "REVIEW_REQUIRED" }), { now: NOW });
  const stale = triage(
    pr({ review_decision: "REVIEW_REQUIRED", updated_at: "2026-08-20T12:00:00Z" }),
    { staleAfterDays: 7, now: NOW },
  );
  assert.equal(fresh.isStale, false);
  assert.equal(stale.isStale, true);
  assert.equal(stale.idleDays, 17);
  assert.ok(stale.severity > fresh.severity, "stale PRs outrank fresh ones");
});

test("isNew is true only for PRs first seen after the last visit", () => {
  const options = { lastViewedAt: "2026-09-03T12:00:00Z", now: NOW };
  assert.equal(triage(pr({ first_seen_at: "2026-09-05T12:00:00Z" }), options).isNew, true);
  assert.equal(triage(pr({ first_seen_at: "2026-09-01T12:00:00Z" }), options).isNew, false);
  assert.equal(triage(pr(), { now: NOW }).isNew, false, "no last visit means nothing is new");
});

test("buildSections splits and sorts the three lists", () => {
  const rows = [
    pr({ id: "a", ci_state: "FAILURE" }),
    pr({ id: "b", review_decision: "REVIEW_REQUIRED" }),
    pr({ id: "c", is_mine: 0, needs_my_review: 1 }),
  ];
  const sections = buildSections(rows, { staleAfterDays: 7, now: NOW });

  assert.deepEqual(sections.attention.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(sections.needsReview.map((p) => p.id), ["c"]);
  assert.deepEqual(sections.mine.map((p) => p.id), ["a", "b"]);
  assert.equal(sections.attention[0].id, "a", "highest severity sorts first");
});
