// Pulls a bug/work item ID out of the PR title and fetches its title +
// description from Azure DevOps, so the AI review can check the diff
// against what the bug actually asked for.
//
// Supports common title conventions out of the box:
//   "AB#1234 Fix null ref in bulk update dialog"
//   "Fixes #1234: null ref crash"
//   "[1234] null ref crash"
//   "Bug 1234 - null ref crash"
// Override with BUG_ID_REGEX (first capture group = the numeric ID) if your
// team uses a different convention.

const fetch = require("node-fetch");

const DEFAULT_PATTERNS = [
  /AB#(\d+)/i,
  /\[(\d+)\]/,
  /bug\s*#?(\d+)/i,
  /#(\d+)/,
];

function extractBugId(prTitle) {
  if (!prTitle) return null;

  const customPattern = process.env.BUG_ID_REGEX;
  const patterns = customPattern ? [new RegExp(customPattern, "i")] : DEFAULT_PATTERNS;

  for (const pattern of patterns) {
    const match = prTitle.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Strips ADO's HTML-formatted description down to plain text — good enough
// for feeding to the model, not meant to be a full HTML parser.
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function fetchWorkItem(bugId) {
  const org = process.env.AZURE_DEVOPS_ORG;
  const pat = process.env.AZURE_DEVOPS_PAT;

  if (!org || !pat) {
    console.error("AZURE_DEVOPS_ORG or AZURE_DEVOPS_PAT not set — skipping bug lookup.");
    return null;
  }

  const url = `https://dev.azure.com/${org}/_apis/wit/workitems/${bugId}?$expand=fields&api-version=7.1`;
  const auth = Buffer.from(`:${pat}`).toString("base64");

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    console.error(`Azure DevOps lookup for work item ${bugId} failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const fields = data.fields || {};

  return {
    id: String(bugId),
    title: fields["System.Title"] || "",
    workItemType: fields["System.WorkItemType"] || "",
    description: stripHtml(fields["System.Description"] || fields["Microsoft.VSTS.TCM.ReproSteps"] || ""),
    state: fields["System.State"] || "",
  };
}

module.exports = { extractBugId, fetchWorkItem };
