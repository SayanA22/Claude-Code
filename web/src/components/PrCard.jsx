import React from "react";

import { diffSize, relativeTime } from "../format.js";

const CI_TAG = {
  SUCCESS: { key: "ci", text: "CI green", tone: "good" },
  FAILURE: { key: "ci", text: "CI failing", tone: "bad" },
  ERROR: { key: "ci", text: "CI error", tone: "bad" },
  PENDING: { key: "ci", text: "CI running", tone: "warn" },
  EXPECTED: { key: "ci", text: "CI queued", tone: "warn" },
};

const REVIEW_TAG = {
  APPROVED: { key: "review", text: "Approved", tone: "good" },
  CHANGES_REQUESTED: { key: "review", text: "Changes requested", tone: "bad" },
  REVIEW_REQUIRED: { key: "review", text: "Needs review", tone: "warn" },
};

const SEVERITY_TONE = { 4: "bad", 3: "warn", 2: "warn", 1: "neutral", 0: "muted" };

// The headline reason already says one of these things, so the corresponding
// detail tag would just repeat it.
const REASON_KEY = {
  "Merge conflict": "conflict",
  "CI failing": "ci",
  "CI running": "ci",
  "Changes requested": "review",
  "Ready to merge": "review",
  "Your review requested": "review",
  Draft: "draft",
};

function Tag({ tone = "neutral", children }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/**
 * Build the tag row, dropping any tag whose meaning the headline already
 * carries. Without this a failing PR reads "CI failing · CI failing".
 */
function buildTags(pr, triage) {
  const reasonKey = REASON_KEY[triage.reason] ?? triage.reason;
  const tags = [
    {
      key: reasonKey,
      text: triage.reason,
      tone: SEVERITY_TONE[triage.severity] ?? "neutral",
    },
  ];

  const candidates = [
    pr.is_draft ? { key: "draft", text: "Draft", tone: "muted" } : null,
    CI_TAG[pr.ci_state] ?? null,
    REVIEW_TAG[pr.review_decision] ?? null,
    pr.mergeable === "CONFLICTING"
      ? { key: "conflict", text: "Conflict", tone: "bad" }
      : null,
    triage.isStale
      ? { key: "stale", text: `Stale ${triage.idleDays}d`, tone: "warn" }
      : null,
  ];

  const seen = new Set([reasonKey]);
  for (const tag of candidates) {
    if (!tag || seen.has(tag.key)) continue;
    seen.add(tag.key);
    tags.push(tag);
  }
  return tags;
}

export default function PrCard({ pr }) {
  const { triage } = pr;
  const tags = buildTags(pr, triage);

  return (
    <a
      className={`card sev-${triage.severity}`}
      href={pr.url}
      target="_blank"
      rel="noreferrer"
    >
      <div className="card-top">
        <span className="repo">{pr.repo}</span>
        <span className="num">#{pr.number}</span>
        {triage.isNew ? <Tag tone="new">new</Tag> : null}
      </div>

      <h3 className="title">{pr.title}</h3>

      <div className="tags">
        {tags.map((tag) => (
          <Tag key={tag.key} tone={tag.tone}>
            {tag.text}
          </Tag>
        ))}
      </div>

      <div className="card-bottom">
        <span className="author">
          {pr.author_avatar ? (
            <img className="avatar" src={pr.author_avatar} alt="" loading="lazy" />
          ) : null}
          {pr.author}
        </span>
        <span className="meta">
          <span className={`size size-${diffSize(pr.additions, pr.deletions)}`}>
            +{pr.additions} −{pr.deletions}
          </span>
          <span className="dot">·</span>
          <span>{pr.changed_files} files</span>
          <span className="dot">·</span>
          <span>updated {relativeTime(pr.updated_at)}</span>
        </span>
      </div>
    </a>
  );
}
