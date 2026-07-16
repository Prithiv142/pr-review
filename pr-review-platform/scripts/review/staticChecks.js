// Runs the deterministic checks that catch things "that should break the
// page": lint errors, type errors, and build failures. These are cheap,
// fast, and don't need AI judgement — they either pass or they don't.
//
// Each check is wrapped so that one failing check doesn't stop the others
// from running; we want a full picture of everything, not just the first
// failure.

const { execSync } = require("child_process");
const { appendFindings } = require("./findingsStore");

function run(label, command, parser) {
  console.log(`\n--- Running ${label} ---`);
  try {
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(output);
    return [];
  } catch (err) {
    // Non-zero exit code means the check found problems — that's expected,
    // not a script failure. stdout/stderr contains the actual error list.
    const output = (err.stdout || "") + (err.stderr || "");
    console.log(output);
    return parser(output);
  }
}

// --- ESLint ---
// Assumes `npm run lint` is configured to output the default stylish
// format. Adjust the regex if your eslint config uses a different formatter.
function parseEslint(output) {
  const findings = [];
  const lines = output.split("\n");
  let currentFile = null;

  for (const line of lines) {
    const fileMatch = line.match(/^([^\s].*\.(tsx?|jsx?))$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }
    // e.g. "  42:10  error  'foo' is not defined  no-undef"
    const problemMatch = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.*)$/);
    if (problemMatch && currentFile) {
      const [, lineNo, , severity, message] = problemMatch;
      findings.push({
        file: currentFile,
        line: Number(lineNo),
        severity: severity === "error" ? "high" : "medium",
        message: message.trim(),
        source: "eslint",
      });
    }
  }
  return findings;
}

// --- TypeScript ---
function parseTsc(output) {
  const findings = [];
  // e.g. "src/foo.ts(12,5): error TS2322: Type 'string' is not assignable..."
  const regex = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.*)$/gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    const [, file, lineNo, code, message] = match;
    findings.push({
      file,
      line: Number(lineNo),
      severity: "high",
      message: `${code}: ${message.trim()}`,
      source: "tsc",
    });
  }
  return findings;
}

// --- Build ---
// Build failures are usually a single hard stop rather than many line-level
// issues, so we report a single high-severity finding with the tail of the
// output for context.
function parseBuild(output) {
  if (!output.trim()) return [];
  const tail = output.trim().split("\n").slice(-15).join("\n");
  return [
    {
      file: null,
      line: null,
      severity: "high",
      message: `Build failed:\n${tail}`,
      source: "build",
    },
  ];
}

async function main() {
  const findings = [
    ...run("ESLint", "npm run lint -- --format=stylish", parseEslint),
    ...run("TypeScript typecheck", "npx tsc --noEmit", parseTsc),
    ...run("Build", "npm run build", parseBuild),
  ];

  appendFindings(findings);
  console.log(`\nStatic checks complete: ${findings.length} finding(s).`);
}

main();
