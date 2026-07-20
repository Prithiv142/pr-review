const GITHUB_API = "https://api.github.com";

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured on the backend.");
  }
  return token;
}

function githubHeaders(accept = "application/vnd.github+json") {
  return {
    Accept: accept,
    Authorization: `Bearer ${getToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchPullRequest(owner, repo, prNumber) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: githubHeaders(),
  });

  if (res.status === 404) {
    throw new Error(`PR not found. Check the URL and that GITHUB_TOKEN can access ${owner}/${repo}.`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }

  return res.json();
}

async function fetchPullRequestDiff(owner, repo, prNumber) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: githubHeaders("application/vnd.github.diff"),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch PR diff (${res.status}): ${text}`);
  }

  return res.text();
}

async function upsertReviewComment(owner, repo, prNumber, body) {
  const COMMENT_MARKER = "<!-- automated-pr-review -->";
  const token = getToken();

  const listRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    { headers: githubHeaders() }
  );

  if (!listRes.ok) {
    throw new Error(`Failed to list PR comments (${listRes.status})`);
  }

  const comments = await listRes.json();
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  const url = existing
    ? `${GITHUB_API}/repos/${owner}/${repo}/issues/comments/${existing.id}`
    : `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to post PR comment (${res.status}): ${text}`);
  }

  return res.json();
}

module.exports = { fetchPullRequest, fetchPullRequestDiff, upsertReviewComment };
