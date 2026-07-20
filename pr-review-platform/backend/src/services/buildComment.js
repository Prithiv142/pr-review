const COMMENT_MARKER = "<!-- automated-pr-review -->";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const SEVERITY_LABEL = { high: "🔴 High", medium: "🟡 Medium", low: "⚪ Low" };
const VERDICT_LABEL = {
  "likely-fixed": "✅ Likely fixed",
  "likely-not-fixed": "❌ Likely NOT fixed",
  unclear: "❓ Unclear",
};

function buildCommentBody(findings, bugVerification) {
  const bugSection = buildBugSection(bugVerification);

  if (!findings.length) {
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
    "_Review triggered manually from the PR Review dashboard._",
  ].join("\n");
}

function buildBugSection(bugVerification) {
  if (!bugVerification) return "";

  const verdict = VERDICT_LABEL[bugVerification.verdict] || bugVerification.verdict;
  const titleLine = bugVerification.title ? ` — ${bugVerification.title}` : "";

  return [
    "### Bug fix verification",
    `**Work item #${bugVerification.bugId}${titleLine}**`,
    `Verdict: ${verdict}`,
    "",
    bugVerification.explanation || "",
    "",
  ].join("\n");
}

module.exports = { buildCommentBody };
