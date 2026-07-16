// Sends the full set of findings from this run to the dashboard backend,
// so they show up filterable by branch there — separate from the PR
// comment, which is just a point-in-time summary.

const fetch = require("node-fetch");
const { loadFindings, loadBugVerification } = require("./findingsStore");

async function main() {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.BACKEND_API_KEY;

  if (!backendUrl) {
    console.error("BACKEND_URL not set — skipping dashboard sync.");
    return;
  }

  const findings = loadFindings();
  const bugVerification = loadBugVerification();

  const payload = {
    repo: process.env.REPO,
    prNumber: Number(process.env.PR_NUMBER),
    sourceBranch: process.env.SOURCE_BRANCH,
    targetBranch: process.env.TARGET_BRANCH,
    commitSha: process.env.COMMIT_SHA,
    findings,
    bugId: bugVerification?.bugId || null,
    bugFixVerification: bugVerification || null,
  };

  const res = await fetch(`${backendUrl}/api/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to send results to dashboard backend (${res.status}): ${text}`);
    // Don't throw — we still want the PR comment step to run even if the
    // dashboard sync failed.
    return;
  }

  console.log(`Sent ${findings.length} finding(s) to dashboard.`);
}

main();
