const prisma = require("../db");
const { parsePrUrl } = require("./parsePrUrl");
const { fetchPullRequest, fetchPullRequestDiff, upsertReviewComment } = require("./github");
const { runAiReview } = require("./aiReview");
const { buildCommentBody } = require("./buildComment");

async function runManualReview(prUrl) {
  const { owner, repo, prNumber } = parsePrUrl(prUrl);
  const repoFullName = `${owner}/${repo}`;

  const pr = await fetchPullRequest(owner, repo, prNumber);
  const targetBranch = pr.base.ref;
  const sourceBranch = pr.head.ref;
  const commitSha = pr.head.sha;
  const prTitle = pr.title || "";

  const branchConfig = await prisma.branchConfig.findUnique({
    where: { branchName: targetBranch },
  });

  if (!branchConfig?.isEnabled) {
    throw new Error(
      `Target branch "${targetBranch}" is not enabled for review. Enable it in dashboard Settings first.`
    );
  }

  const diff = await fetchPullRequestDiff(owner, repo, prNumber);
  const { findings, bugFixVerification, bugId } = await runAiReview({ diff, prTitle });

  const review = await prisma.review.create({
    data: {
      repo: repoFullName,
      prNumber,
      sourceBranch,
      targetBranch,
      commitSha,
      findings,
      bugId: bugId || null,
      bugFixVerification: bugFixVerification || undefined,
    },
  });

  const commentBody = buildCommentBody(findings, bugFixVerification);
  await upsertReviewComment(owner, repo, prNumber, commentBody);

  return review;
}

module.exports = { runManualReview };
