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

  if (!org || !pat) return null;

  const url = `https://dev.azure.com/${org}/_apis/wit/workitems/${bugId}?$expand=fields&api-version=7.1`;
  const auth = Buffer.from(`:${pat}`).toString("base64");

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const fields = data.fields || {};

  return {
    id: String(bugId),
    title: fields["System.Title"] || "",
    workItemType: fields["System.WorkItemType"] || "",
    description: stripHtml(
      fields["System.Description"] || fields["Microsoft.VSTS.TCM.ReproSteps"] || ""
    ),
    state: fields["System.State"] || "",
  };
}

module.exports = { extractBugId, fetchWorkItem };
