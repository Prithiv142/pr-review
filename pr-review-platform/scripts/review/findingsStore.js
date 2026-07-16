// Shared helpers for reading/writing the findings file that all review
// steps append to. Keeping one flat JSON file is simplest since each
// GitHub Actions step runs as a separate process but shares the workspace.

const fs = require("fs");
const path = require("path");

const FINDINGS_PATH = path.join(__dirname, "findings.json");

/**
 * A single finding looks like:
 * {
 *   file: "src/components/BulkUpdateModal.tsx",
 *   line: 42,               // optional, null if not line-specific
 *   severity: "high" | "medium" | "low",
 *   message: "Missing null check before accessing item.metadata.owner",
 *   source: "eslint" | "tsc" | "build" | "ai"
 * }
 */

function loadFindings() {
  if (!fs.existsSync(FINDINGS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FINDINGS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function appendFindings(newFindings) {
  const existing = loadFindings();
  const merged = existing.concat(newFindings);
  fs.writeFileSync(FINDINGS_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

const BUG_VERIFICATION_PATH = path.join(__dirname, "bugVerification.json");

/**
 * Bug verification result looks like:
 * {
 *   bugId: "12345",
 *   title: "Fix null ref in bulk update dialog",   // ADO work item title
 *   verdict: "likely-fixed" | "likely-not-fixed" | "unclear",
 *   explanation: "short reasoning"
 * }
 * null if no bug id was found in the PR title, or the work item lookup failed.
 */

function saveBugVerification(result) {
  fs.writeFileSync(BUG_VERIFICATION_PATH, JSON.stringify(result, null, 2));
}

function loadBugVerification() {
  if (!fs.existsSync(BUG_VERIFICATION_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BUG_VERIFICATION_PATH, "utf8"));
  } catch {
    return null;
  }
}

module.exports = {
  loadFindings,
  appendFindings,
  FINDINGS_PATH,
  saveBugVerification,
  loadBugVerification,
};
