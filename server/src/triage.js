/**
 * Turn a raw pull request into a verdict: who is this waiting on, and how
 * urgent is it? This is the whole point of the dashboard -- GitHub can already
 * list your PRs, but it will not tell you which ones are your problem.
 *
 * Kept pure and dependency-free so it is trivial to test.
 */

export const BLOCKED_ON = {
  YOU: "you",
  THEM: "them",
  NOBODY: "nobody",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(isoString, now = Date.now()) {
  const then = Date.parse(isoString);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now - then) / DAY_MS);
}

/**
 * Reasons are ordered most- to least- urgent. The first match wins, and it
 * becomes the badge the UI shows.
 */
function verdictForMyPr(pr) {
  if (pr.is_draft) {
    return { blockedOn: BLOCKED_ON.NOBODY, reason: "Draft", severity: 0 };
  }
  if (pr.mergeable === "CONFLICTING") {
    return { blockedOn: BLOCKED_ON.YOU, reason: "Merge conflict", severity: 4 };
  }
  if (pr.ci_state === "FAILURE" || pr.ci_state === "ERROR") {
    return { blockedOn: BLOCKED_ON.YOU, reason: "CI failing", severity: 4 };
  }
  if (pr.review_decision === "CHANGES_REQUESTED") {
    return { blockedOn: BLOCKED_ON.YOU, reason: "Changes requested", severity: 3 };
  }
  if (pr.review_decision === "APPROVED" && pr.ci_state !== "PENDING") {
    return { blockedOn: BLOCKED_ON.YOU, reason: "Ready to merge", severity: 3 };
  }
  if (pr.ci_state === "PENDING") {
    return { blockedOn: BLOCKED_ON.NOBODY, reason: "CI running", severity: 1 };
  }
  return { blockedOn: BLOCKED_ON.THEM, reason: "Awaiting review", severity: 1 };
}

function verdictForReviewPr(pr) {
  if (pr.is_draft) {
    return { blockedOn: BLOCKED_ON.NOBODY, reason: "Draft", severity: 0 };
  }
  return { blockedOn: BLOCKED_ON.YOU, reason: "Your review requested", severity: 3 };
}

/**
 * @param {object} pr        a row from the pull_requests table
 * @param {object} options   { staleAfterDays, lastViewedAt, now }
 */
export function triage(pr, { staleAfterDays = 7, lastViewedAt = null, now = Date.now() } = {}) {
  const verdict = pr.needs_my_review ? verdictForReviewPr(pr) : verdictForMyPr(pr);
  const idleDays = daysSince(pr.updated_at, now);
  const isStale = idleDays >= staleAfterDays && !pr.is_draft;

  // A stale PR that is waiting on someone else is still your problem -- it is
  // the one you have to go nudge. Bump it so it does not sink to the bottom.
  const severity = isStale ? Math.max(verdict.severity, 2) : verdict.severity;

  return {
    ...verdict,
    severity,
    isStale,
    idleDays: Math.floor(idleDays),
    ageDays: Math.floor(daysSince(pr.created_at, now)),
    isNew: Boolean(lastViewedAt && Date.parse(pr.first_seen_at) > Date.parse(lastViewedAt)),
  };
}

/**
 * Group triaged PRs into the three lists the UI renders.
 * "attention" is deliberately allowed to overlap the other two: a PR you must
 * act on should appear at the top even though it is also listed below.
 */
export function buildSections(rows, options) {
  const decorated = rows.map((pr) => ({ ...pr, triage: triage(pr, options) }));

  const bySeverityThenIdle = (a, b) =>
    b.triage.severity - a.triage.severity || b.triage.idleDays - a.triage.idleDays;

  return {
    attention: decorated
      .filter((pr) => pr.triage.blockedOn === BLOCKED_ON.YOU)
      .sort(bySeverityThenIdle),
    needsReview: decorated
      .filter((pr) => pr.needs_my_review)
      .sort(bySeverityThenIdle),
    mine: decorated
      .filter((pr) => pr.is_mine)
      .sort(bySeverityThenIdle),
    all: decorated,
  };
}
