// Thin fetch wrapper for talking to the backend from client components.
// Read-only calls (GET) don't need the API key — only writes do, and those
// go through the Next.js server actions in settings/actions.js instead of
// calling the backend directly from the browser.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export async function getReviews({ branch, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (branch) params.set("branch", branch);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`${BACKEND_URL}/api/reviews?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load reviews (${res.status})`);
  return res.json();
}

export async function getBranchConfigs() {
  const res = await fetch(`${BACKEND_URL}/api/config/branches`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load branch config (${res.status})`);
  return res.json();
}
