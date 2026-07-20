"use server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.BACKEND_API_KEY;

export async function startManualReview(prUrl) {
  const trimmed = prUrl?.trim();
  if (!trimmed) {
    throw new Error("Please enter a GitHub PR URL.");
  }

  const res = await fetch(`${BACKEND_URL}/api/reviews/run-manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ prUrl: trimmed }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to start review (${res.status}): ${text}`);
  }

  return res.json();
}

export async function getReviewJob(jobId) {
  const res = await fetch(`${BACKEND_URL}/api/reviews/jobs/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to check job status (${res.status}): ${text}`);
  }

  return res.json();
}
