import { config } from "./config.js";

const ENDPOINT = "https://api.github.com/graphql";

/**
 * Everything the dashboard needs, in one round trip.
 *
 * Two search queries share a single request, and each PR node carries its own
 * CI rollup and review state. Doing this over REST would be one call per PR
 * per signal; here it is ~2 rate-limit points per sync out of 5000 per hour.
 */
const QUERY = `
query Radar($reviewQuery: String!, $mineQuery: String!) {
  viewer { login avatarUrl }
  needsReview: search(query: $reviewQuery, type: ISSUE, first: 40) {
    nodes { ...prFields }
  }
  mine: search(query: $mineQuery, type: ISSUE, first: 60) {
    nodes { ...prFields }
  }
  rateLimit { remaining resetAt }
}

fragment prFields on PullRequest {
  id
  number
  title
  url
  isDraft
  createdAt
  updatedAt
  additions
  deletions
  changedFiles
  reviewDecision
  mergeable
  author { login avatarUrl }
  repository { nameWithOwner }
  comments { totalCount }
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup { state }
      }
    }
  }
}
`;

export class GitHubError extends Error {
  constructor(message, { status = null, hint = null } = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.hint = hint;
  }
}

async function graphql(variables) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "User-Agent": "pr-radar",
      },
      body: JSON.stringify({ query: QUERY, variables }),
    });
  } catch (cause) {
    throw new GitHubError(`Could not reach api.github.com: ${cause.message}`, {
      hint: "Check your network connection or proxy settings.",
    });
  }

  if (response.status === 401) {
    throw new GitHubError("GitHub rejected the token (401).", {
      status: 401,
      hint: "The token is invalid or expired. Generate a new one and update GITHUB_TOKEN in .env.",
    });
  }
  if (response.status === 403) {
    throw new GitHubError("GitHub returned 403.", {
      status: 403,
      hint: "Usually a missing scope (classic tokens need `repo`) or a rate limit. Check the token's permissions.",
    });
  }
  if (!response.ok) {
    throw new GitHubError(
      `GitHub returned ${response.status} ${response.statusText}.`,
      { status: response.status },
    );
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new GitHubError(
      payload.errors.map((error) => error.message).join("; "),
      { hint: "The GraphQL query was rejected. This usually means the token lacks access to one of the repositories." },
    );
  }
  return payload.data;
}

function normalize(node, { viewerLogin, needsMyReview }) {
  const repo = node.repository?.nameWithOwner ?? "unknown/unknown";
  const rollup = node.commits?.nodes?.[0]?.commit?.statusCheckRollup ?? null;
  return {
    id: node.id,
    repo,
    number: node.number,
    title: node.title,
    url: node.url,
    author: node.author?.login ?? "ghost",
    authorAvatar: node.author?.avatarUrl ?? null,
    isDraft: Boolean(node.isDraft),
    isMine: node.author?.login === viewerLogin,
    needsMyReview,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    reviewDecision: node.reviewDecision ?? null,
    mergeable: node.mergeable ?? null,
    // No checks configured is a different thing from checks that haven't run.
    ciState: rollup?.state ?? "NONE",
    additions: node.additions ?? 0,
    deletions: node.deletions ?? 0,
    changedFiles: node.changedFiles ?? 0,
    commentCount: node.comments?.totalCount ?? 0,
  };
}

/**
 * Fetch the viewer's open PRs plus the ones awaiting their review.
 * Returns { viewer, pullRequests, rateLimit }.
 */
export async function fetchDashboard() {
  const data = await graphql({
    reviewQuery: "is:open is:pr review-requested:@me archived:false",
    mineQuery: "is:open is:pr author:@me archived:false",
  });

  const viewerLogin = data.viewer.login;
  const byId = new Map();

  for (const node of data.needsReview.nodes ?? []) {
    if (!node?.id) continue; // search can return non-PR issue nodes
    byId.set(node.id, normalize(node, { viewerLogin, needsMyReview: true }));
  }
  for (const node of data.mine.nodes ?? []) {
    if (!node?.id) continue;
    const existing = byId.get(node.id);
    const normalized = normalize(node, {
      viewerLogin,
      // A PR can be both mine and requested of me; keep the review flag.
      needsMyReview: existing?.needsMyReview ?? false,
    });
    byId.set(node.id, normalized);
  }

  let pullRequests = [...byId.values()];
  if (config.repoFilter.length > 0) {
    pullRequests = pullRequests.filter((pr) =>
      config.repoFilter.includes(pr.repo.toLowerCase()),
    );
  }

  return {
    viewer: { login: viewerLogin, avatarUrl: data.viewer.avatarUrl },
    pullRequests,
    rateLimit: data.rateLimit ?? null,
  };
}
