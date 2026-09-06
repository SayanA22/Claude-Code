/**
 * Sample data for `npm run demo`, so the dashboard can be seen without a
 * GitHub token. Not used in normal operation.
 */
const day = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * day).toISOString();

export const DEMO_PULL_REQUESTS = [
  {
    id: "demo-1", repo: "acme/api", number: 4821,
    title: "Fix race condition in session refresh",
    url: "https://github.com/acme/api/pull/4821",
    author: "you", authorAvatar: null, isDraft: false, isMine: true, needsMyReview: false,
    createdAt: ago(3), updatedAt: ago(0.2), reviewDecision: "APPROVED",
    mergeable: "MERGEABLE", ciState: "FAILURE",
    additions: 87, deletions: 23, changedFiles: 5, commentCount: 4,
  },
  {
    id: "demo-2", repo: "acme/web", number: 1190,
    title: "Migrate settings page to the new form primitives",
    url: "https://github.com/acme/web/pull/1190",
    author: "you", authorAvatar: null, isDraft: false, isMine: true, needsMyReview: false,
    createdAt: ago(12), updatedAt: ago(9), reviewDecision: "REVIEW_REQUIRED",
    mergeable: "CONFLICTING", ciState: "SUCCESS",
    additions: 640, deletions: 512, changedFiles: 31, commentCount: 12,
  },
  {
    id: "demo-3", repo: "acme/api", number: 4835,
    title: "Add pagination to the audit log endpoint",
    url: "https://github.com/acme/api/pull/4835",
    author: "you", authorAvatar: null, isDraft: false, isMine: true, needsMyReview: false,
    createdAt: ago(1), updatedAt: ago(0.05), reviewDecision: "REVIEW_REQUIRED",
    mergeable: "MERGEABLE", ciState: "PENDING",
    additions: 44, deletions: 6, changedFiles: 3, commentCount: 0,
  },
  {
    id: "demo-4", repo: "acme/infra", number: 302,
    title: "Bump Terraform provider to 5.x",
    url: "https://github.com/acme/infra/pull/302",
    author: "you", authorAvatar: null, isDraft: true, isMine: true, needsMyReview: false,
    createdAt: ago(5), updatedAt: ago(4), reviewDecision: null,
    mergeable: "MERGEABLE", ciState: "SUCCESS",
    additions: 18, deletions: 14, changedFiles: 2, commentCount: 1,
  },
  {
    id: "demo-5", repo: "acme/web", number: 1201,
    title: "Dark mode for the billing dashboard",
    url: "https://github.com/acme/web/pull/1201",
    author: "priya", authorAvatar: null, isDraft: false, isMine: false, needsMyReview: true,
    createdAt: ago(2), updatedAt: ago(0.6), reviewDecision: "REVIEW_REQUIRED",
    mergeable: "MERGEABLE", ciState: "SUCCESS",
    additions: 210, deletions: 45, changedFiles: 9, commentCount: 2,
  },
  {
    id: "demo-6", repo: "acme/api", number: 4790,
    title: "Retry webhook deliveries with exponential backoff",
    url: "https://github.com/acme/api/pull/4790",
    author: "marcus", authorAvatar: null, isDraft: false, isMine: false, needsMyReview: true,
    createdAt: ago(21), updatedAt: ago(11), reviewDecision: "REVIEW_REQUIRED",
    mergeable: "MERGEABLE", ciState: "SUCCESS",
    additions: 1340, deletions: 88, changedFiles: 47, commentCount: 19,
  },
];
