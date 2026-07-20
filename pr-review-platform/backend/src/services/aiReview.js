const Anthropic = require("@anthropic-ai/sdk");
const { extractBugId, fetchWorkItem } = require("./fetchWorkItem");

const MAX_DIFF_CHARS = 60000;

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
  ]`;

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

function parseModelJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function callGemini({ systemPrompt, userContent }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the backend.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No text response from Gemini.");
  }

  return text;
}

async function callAnthropic({ systemPrompt, userContent }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the backend.");
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("No text response from Claude.");
  }

  return textBlock.text;
}

async function callAiModel({ systemPrompt, userContent }) {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  if (provider === "anthropic") {
    return callAnthropic({ systemPrompt, userContent });
  }

  if (provider === "gemini") {
    return callGemini({ systemPrompt, userContent });
  }

  throw new Error(`Unsupported AI_PROVIDER "${provider}". Use "gemini" or "anthropic".`);
}

async function runAiReview({ diff, prTitle }) {
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "No AI key configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY on the backend."
    );
  }

  let trimmedDiff = diff;
  if (!trimmedDiff.trim()) {
    return { findings: [], bugFixVerification: null, bugId: null };
  }
  if (trimmedDiff.length > MAX_DIFF_CHARS) {
    trimmedDiff = trimmedDiff.slice(0, MAX_DIFF_CHARS);
  }

  const bugId = extractBugId(prTitle);
  let workItem = null;
  if (bugId) {
    workItem = await fetchWorkItem(bugId);
  }

  const systemPrompt = BASE_SYSTEM_PROMPT + (workItem ? WITH_BUG_SUFFIX : WITHOUT_BUG_SUFFIX);

  let userContent = `Review this PR diff:\n\n${trimmedDiff}`;
  if (workItem) {
    userContent += `\n\n---\n\nThis PR claims to fix Azure DevOps work item #${workItem.id} (${workItem.workItemType}, state: ${workItem.state}):\n\nTitle: ${workItem.title}\n\nDescription:\n${workItem.description || "(no description provided)"}\n\nAssess whether the diff above actually addresses this bug.`;
  }

  const rawText = await callAiModel({ systemPrompt, userContent });

  let parsed;
  try {
    parsed = parseModelJson(rawText);
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err.message}`);
  }

  const findings = (parsed.findings || []).map((f) => ({
    file: f.file || null,
    line: f.line ?? null,
    severity: ["high", "medium", "low"].includes(f.severity) ? f.severity : "medium",
    message: f.message,
    source: "ai",
  }));

  let bugFixVerification = null;
  if (workItem && parsed.bugFixVerification) {
    bugFixVerification = {
      bugId: workItem.id,
      title: workItem.title,
      verdict: parsed.bugFixVerification.verdict || "unclear",
      explanation: parsed.bugFixVerification.explanation || "",
    };
  } else if (bugId && !workItem) {
    bugFixVerification = {
      bugId,
      title: null,
      verdict: "unclear",
      explanation: "Could not fetch this work item from Azure DevOps to verify the fix.",
    };
  }

  return { findings, bugFixVerification, bugId: bugFixVerification?.bugId || bugId || null };
}

module.exports = { runAiReview };
