// Posts the findings as a single PR comment. If a previous review comment
// already exists on this PR (from an earlier push), it updates that comment
// instead of adding a new one each time — keeps the PR thread clean.

const { Octokit } = require("@octokit/rest");
const { loadFindings, loadBugVerification } = require("./findingsStore");

const COMMENT_MARKER = "<!-- automated-pr-review -->";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const SEVERITY_LABEL = { high: "🔴 High", medium: "🟡 Medium", low: "⚪ Low" };
const VERDICT_LABEL = {
  "likely-fixed": "✅ Likely fixed",
  "likely-not-fixed": "❌ Likely NOT fixed",
  unclear: "❓ Unclear",
};

function buildBugSection(bugVerification) {
  if (!bugVerification) return "";

  const verdict = VERDICT_LABEL[bugVerification.verdict] || bugVerification.verdict;
  const titleLine = bugVerification.title ? ` — ${bugVerification.title}` : "";

  return [
    `### Bug fix verification`,
    `**Work item #${bugVerification.bugId}${titleLine}**`,
    `Verdict: ${verdict}`,
    "",
    bugVerification.explanation || "",
    "",
  ].join("\n");
}

function buildCommentBody(findings, bugVerification) {
  const bugSection = buildBugSection(bugVerification);

  if (findings.length === 0) {
    return `${COMMENT_MARKER}\n${bugSection}### Automated review\nNo issues found. ✅`;
  }

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  const rows = sorted
    .map((f) => {
      const location = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ""}\`` : "—";
      return `| ${SEVERITY_LABEL[f.severity]} | ${location} | ${f.source} | ${f.message.replace(/\n/g, " ")} |`;
    })
    .join("\n");

  const counts = sorted.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  const summary = Object.entries(counts)
    .map(([sev, count]) => `${SEVERITY_LABEL[sev]}: ${count}`)
    .join(" · ");

  return [
    COMMENT_MARKER,
    bugSection,
    "### Automated review",
    summary,
    "",
    "| Severity | Location | Source | Finding |",
    "|---|---|---|---|",
    rows,
    "",
    "_This comment updates automatically on new pushes to this PR._",
  ].join("\n");
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const [owner, repo] = process.env.REPO.split("/");
  const prNumber = Number(process.env.PR_NUMBER);

  const octokit = new Octokit({ auth: token });
  const findings = loadFindings();
  const bugVerification = loadBugVerification();
  const body = buildCommentBody(findings, bugVerification);

  const { data: comments } = await octokit.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    console.log(`Updated existing review comment (#${existing.id}).`);
  } else {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    console.log("Posted new review comment.");
  }
}

main().catch((err) => {
  console.error("Failed to post PR comment:", err);
});
