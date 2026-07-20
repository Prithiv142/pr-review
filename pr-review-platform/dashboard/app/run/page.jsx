import RunReviewForm from "./RunReviewForm";

export default function RunReviewPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>Run a review</h1>
      <p style={{ color: "#9aa0aa", maxWidth: 640 }}>
        Paste a GitHub PR URL to review it manually — no workflow or repo changes needed.
        The PR&apos;s <strong>target branch</strong> must be enabled in{" "}
        <a href="/settings">Settings</a> (e.g. Dev). Results appear here and as a comment on the PR.
      </p>
      <RunReviewForm />
    </div>
  );
}
