"use client";

import { useState } from "react";
import { startManualReview, getReviewJob } from "./actions";

export default function RunReviewForm() {
  const [prUrl, setPrUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [reviewId, setReviewId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("starting");
    setMessage("Starting review...");
    setReviewId(null);

    try {
      const { jobId } = await startManualReview(prUrl);
      setStatus("running");
      setMessage("Review in progress — fetching PR diff and running AI analysis...");

      const poll = async () => {
        const job = await getReviewJob(jobId);

        if (job.status === "completed") {
          setStatus("done");
          setReviewId(job.review?.id || null);
          setMessage(
            `Review complete for PR #${job.review?.prNumber} (${job.review?.sourceBranch} → ${job.review?.targetBranch}). A comment was posted on GitHub.`
          );
          return;
        }

        if (job.status === "failed") {
          setStatus("error");
          setMessage(job.error || "Review failed.");
          return;
        }

        setTimeout(poll, 2000);
      };

      await poll();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Something went wrong.");
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <label style={{ color: "#9aa0aa" }}>
          GitHub PR URL
          <input
            type="url"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://github.com/your-org/PolicyManagementSPFx/pull/123"
            required
            style={{ display: "block", width: "100%", marginTop: 6 }}
          />
        </label>
        <p style={{ color: "#9aa0aa", fontSize: 14, margin: 0 }}>
          Shorthand also works: <code>your-org/PolicyManagementSPFx#123</code>
        </p>
        <button type="submit" disabled={status === "starting" || status === "running"}>
          {status === "running" ? "Reviewing..." : "Run review"}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: 16,
            color: status === "error" ? "#e5484d" : status === "done" ? "#4ade80" : "#9aa0aa",
          }}
        >
          {message}
        </p>
      )}

      {reviewId && (
        <p style={{ marginTop: 8 }}>
          <a href="/">View all reviews on the dashboard →</a>
        </p>
      )}
    </div>
  );
}
