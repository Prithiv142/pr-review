"use client";

import { useEffect, useState } from "react";
import { getReviews } from "../lib/api";

const SEVERITY_COLOR = { high: "#e5484d", medium: "#f5a524", low: "#9aa0aa" };
const VERDICT_COLOR = { "likely-fixed": "#4ade80", "likely-not-fixed": "#e5484d", unclear: "#9aa0aa" };
const VERDICT_LABEL = { "likely-fixed": "Likely fixed", "likely-not-fixed": "Likely NOT fixed", unclear: "Unclear" };

function severityCounts(findings) {
  return (findings || []).reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
}

export default function ReviewsPage() {
  const [branch, setBranch] = useState("");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getReviews({ branch: branch || undefined })
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [branch]);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>Review feedback</h1>

      <div style={{ margin: "16px 0" }}>
        <label style={{ marginRight: 8, color: "#9aa0aa" }}>Filter by source branch:</label>
        <input
          placeholder="e.g. Prithiv"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          style={{ minWidth: 220 }}
        />
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: SEVERITY_COLOR.high }}>Error: {error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <p style={{ color: "#9aa0aa" }}>No review runs found{branch ? ` for branch "${branch}"` : ""}.</p>
      )}

      {!loading && reviews.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>PR</th>
              <th>From → To</th>
              <th>Bug</th>
              <th>Commit</th>
              <th>Findings</th>
              <th>Run at</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => {
              const counts = severityCounts(r.findings);
              const isOpen = expanded === r.id;
              return (
                <>
                  <tr
                    key={r.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <td>#{r.prNumber}</td>
                    <td>{r.sourceBranch} → {r.targetBranch}</td>
                    <td>
                      {r.bugId ? (
                        <span>
                          #{r.bugId}
                          {r.bugFixVerification && (
                            <div style={{ color: VERDICT_COLOR[r.bugFixVerification.verdict], fontSize: 12 }}>
                              {VERDICT_LABEL[r.bugFixVerification.verdict] || r.bugFixVerification.verdict}
                            </div>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: "#9aa0aa" }}>—</span>
                      )}
                    </td>
                    <td><code>{r.commitSha.slice(0, 7)}</code></td>
                    <td>
                      {Object.entries(counts).length === 0 && "None"}
                      {Object.entries(counts).map(([sev, count]) => (
                        <span key={sev} style={{ color: SEVERITY_COLOR[sev], marginRight: 10 }}>
                          {sev}: {count}
                        </span>
                      ))}
                    </td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                  {isOpen && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={6} style={{ background: "#161920" }}>
                        {r.bugFixVerification && (
                          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #2a2d34" }}>
                            <strong style={{ color: VERDICT_COLOR[r.bugFixVerification.verdict] }}>
                              Bug #{r.bugFixVerification.bugId} — {VERDICT_LABEL[r.bugFixVerification.verdict] || r.bugFixVerification.verdict}
                            </strong>
                            {r.bugFixVerification.title && <div style={{ color: "#9aa0aa" }}>{r.bugFixVerification.title}</div>}
                            <p style={{ margin: "6px 0 0" }}>{r.bugFixVerification.explanation}</p>
                          </div>
                        )}
                        <FindingsDetail findings={r.findings} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FindingsDetail({ findings }) {
  if (!findings || findings.length === 0) return <p>No findings on this run.</p>;

  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {findings.map((f, i) => (
        <li key={i} style={{ marginBottom: 8 }}>
          <span style={{ color: SEVERITY_COLOR[f.severity], fontWeight: 500 }}>[{f.severity}]</span>{" "}
          <code>{f.file || "—"}{f.line ? `:${f.line}` : ""}</code>{" "}
          <span style={{ color: "#9aa0aa" }}>({f.source})</span> — {f.message}
        </li>
      ))}
    </ul>
  );
}
