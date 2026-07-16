// Asks the dashboard backend whether the PR's target branch is enabled
// for automated review. Sets a GitHub Actions output `enabled` (true/false)
// that later steps use as their `if:` condition.
//
// This is what lets the "which branch is eligible" toggle live in the
// dashboard UI instead of being hardcoded in the workflow YAML.

const fetch = require("node-fetch");
const fs = require("fs");

async function main() {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.BACKEND_API_KEY;
  const targetBranch = process.env.TARGET_BRANCH;

  if (!backendUrl) {
    console.error("BACKEND_URL is not set — failing closed (treating branch as not eligible).");
    setOutput("enabled", "false");
    return;
  }

  try {
    const res = await fetch(
      `${backendUrl}/api/config/branches/${encodeURIComponent(targetBranch)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (res.status === 404) {
      // Branch has no config entry yet — default to NOT eligible.
      // Safer default: new branches don't silently get reviewed until
      // someone explicitly enables them in the dashboard.
      console.log(`No config entry for "${targetBranch}" — treating as not eligible.`);
      setOutput("enabled", "false");
      return;
    }

    if (!res.ok) {
      console.error(`Config lookup failed with status ${res.status} — failing closed.`);
      setOutput("enabled", "false");
      return;
    }

    const data = await res.json();
    const enabled = Boolean(data.isEnabled);
    console.log(`Branch "${targetBranch}" eligibility: ${enabled}`);
    setOutput("enabled", String(enabled));
  } catch (err) {
    console.error("Error checking branch eligibility, failing closed:", err.message);
    setOutput("enabled", "false");
  }
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  } else {
    console.log(`[output] ${name}=${value}`);
  }
}

main();
