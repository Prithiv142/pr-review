// A single shared API key gates write access from the GitHub Action.
// Simple on purpose — this isn't a multi-tenant system, just one CI job
// and one dashboard talking to one backend.

function requireApiKey(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");

  if (!process.env.API_KEY) {
    console.error("API_KEY is not configured on the server.");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  if (token !== process.env.API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  next();
}

module.exports = { requireApiKey };
