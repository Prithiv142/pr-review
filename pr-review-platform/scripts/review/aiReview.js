// Sends the PR diff to Claude and asks for a structured list of findings
// focused on things static analysis can't catch: logic gaps, missing error
// handling, missing validation, accessibility issues, things that were
// "should've been done but weren't" for this team's codebase.

const { execSync } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");
const { appendFindings, saveBugVerification } = require("./findingsStore");
const { extractBugId, fetchWorkItem } = require("./fetchWorkItem");

const MAX_DIFF_CHARS = 60000; // keep the prompt a reasonable size

function getDiff(baseSha, headSha) {
  return execSync(`git diff ${baseSha} ${headSha} -- . ':(exclude)*.lock' ':(exclude)*lock.json'`, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
}

const BASE_SYSTEM_PROMPT = `You are an experienced senior engineer doing a focused code review on a pull request diff.

Only flag things that are genuinely worth a reviewer's attention:
- Logic bugs, unhandled edge cases, missing null/undefined checks
- Missing error handling around API calls, file operations, or async code
- Missing validation that the surrounding code pattern would normally require
- Accessibility issues (missing aria attributes, keyboard focus handling, label associations) in UI components
- Obvious performance issues (e.g. unnecessary loops calling APIs per-item, missing memoization on expensive renders)

Do NOT flag:
- Style preferences already covered by a linter
- Minor naming nitpicks
- Anything you are not reasonably confident about

Respond with ONLY a JSON object (no markdown fences, no prose) with this shape:
{
  "findings": [
    {"file": "path/to/file", "line": 42, "severity": "high"|"medium"|"low", "message": "short, specific explanation"}
  ]${""}`;

const WITH_BUG_SUFFIX = `,
  "bugFixVerification": {
    "verdict": "likely-fixed" | "likely-not-fixed" | "unclear",
    "explanation": "1-3 sentences on whether the diff addresses the bug description below, referencing specific changes"
  }
}

If there is nothing worth flagging, use an empty findings array. Base the verdict only on
whether the code changes plausibly address the described bug — if the diff seems unrelated
or only partially addresses it, say so plainly rather than assuming good intent.`;

const WITHOUT_BUG_SUFFIX = `
}

If there is nothing worth flagging, use an empty findings array.`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set — skipping AI review.");
    return;
  }

  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;
  const prTitle = process.env.PR_TITLE || "";

  let diff = getDiff(baseSha, headSha);
  if (!diff.trim()) {
    console.log("No diff content to review.");
    return;
  }
  if (diff.length > MAX_DIFF_CHARS) {
    console.log(`Diff is large (${diff.length} chars) — truncating to ${MAX_DIFF_CHARS} chars.`);
    diff = diff.slice(0, MAX_DIFF_CHARS);
  }

  // --- Bug lookup ---
  const bugId = extractBugId(prTitle);
  let workItem = null;
  if (bugId) {
    console.log(`Found bug/work item ID ${bugId} in PR title — fetching from Azure DevOps.`);
    workItem = await fetchWorkItem(bugId);
  } else {
    console.log("No bug/work item ID found in PR title — skipping bug fix verification.");
  }

  const systemPrompt = BASE_SYSTEM_PROMPT + (workItem ? WITH_BUG_SUFFIX : WITHOUT_BUG_SUFFIX);

  let userContent = `Review this PR diff:\n\n${diff}`;
  if (workItem) {
    userContent += `\n\n---\n\nThis PR claims to fix Azure DevOps work item #${workItem.id} (${workItem.workItemType}, state: ${workItem.state}):\n\nTitle: ${workItem.title}\n\nDescription:\n${workItem.description || "(no description provided)"}\n\nAssess whether the diff above actually addresses this bug.`;
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    console.error("No text response from Claude.");
    return;
  }

  let parsed;
  try {
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse Claude's response as JSON:", err.message);
    console.error("Raw response:", textBlock.text);
    return;
  }

  const findings = (parsed.findings || []).map((f) => ({
    file: f.file || null,
    line: f.line ?? null,
    severity: ["high", "medium", "low"].includes(f.severity) ? f.severity : "medium",
    message: f.message,
    source: "ai",
  }));

  appendFindings(findings);
  console.log(`AI review complete: ${findings.length} finding(s).`);

  if (workItem && parsed.bugFixVerification) {
    saveBugVerification({
      bugId: workItem.id,
      title: workItem.title,
      verdict: parsed.bugFixVerification.verdict || "unclear",
      explanation: parsed.bugFixVerification.explanation || "",
    });
    console.log(`Bug fix verification: ${parsed.bugFixVerification.verdict}`);
  } else if (bugId && !workItem) {
    // Bug ID was in the title but the ADO lookup failed — still surface that
    // so it's visible in the PR comment rather than silently skipped.
    saveBugVerification({
      bugId,
      title: null,
      verdict: "unclear",
      explanation: "Could not fetch this work item from Azure DevOps to verify the fix.",
    });
  }
}

main().catch((err) => {
  console.error("AI review failed:", err);
  // Don't throw — a failed AI review shouldn't take down the whole workflow
  // when static checks + reporting are more important to always complete.
});
