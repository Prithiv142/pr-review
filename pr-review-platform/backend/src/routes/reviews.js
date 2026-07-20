const express = require("express");
const prisma = require("../db");
const { requireApiKey } = require("../auth");
const { createJob, updateJob, getJob } = require("../jobs");
const { runManualReview } = require("../services/manualReview");

const router = express.Router();

// POST /api/reviews — called by the GitHub Action at the end of a review run.
router.post("/", requireApiKey, async (req, res) => {
  const {
    repo,
    prNumber,
    sourceBranch,
    targetBranch,
    commitSha,
    findings,
    bugId,
    bugFixVerification,
  } = req.body;

  if (!repo || !prNumber || !sourceBranch || !targetBranch || !commitSha) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const review = await prisma.review.create({
    data: {
      repo,
      prNumber,
      sourceBranch,
      targetBranch,
      commitSha,
      findings: findings || [],
      bugId: bugId || null,
      bugFixVerification: bugFixVerification || undefined,
    },
  });

  res.status(201).json(review);
});

// GET /api/reviews?branch=Prithiv&limit=50 — used by the dashboard.
// `branch` matches against sourceBranch (the "from branch" the user asked for).
router.get("/", async (req, res) => {
  const { branch, prNumber, limit } = req.query;

  const where = {};
  if (branch) where.sourceBranch = String(branch);
  if (prNumber) where.prNumber = Number(prNumber);

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit ? Number(limit) : 50,
  });

  res.json(reviews);
});

// POST /api/reviews/run-manual — trigger a review from the dashboard (no repo workflow needed).
// Returns a job id immediately; poll GET /api/reviews/jobs/:jobId for status.
router.post("/run-manual", requireApiKey, async (req, res) => {
  const { prUrl } = req.body;

  if (!prUrl || typeof prUrl !== "string") {
    return res.status(400).json({ error: "prUrl is required" });
  }

  const job = createJob(prUrl.trim());

  setImmediate(async () => {
    updateJob(job.id, { status: "running" });
    try {
      const review = await runManualReview(job.prUrl);
      updateJob(job.id, { status: "completed", review });
    } catch (err) {
      console.error("Manual review failed:", err);
      updateJob(job.id, { status: "failed", error: err.message || "Review failed" });
    }
  });

  res.status(202).json({ jobId: job.id, status: job.status });
});

// GET /api/reviews/jobs/:jobId — poll manual review progress.
router.get("/jobs/:jobId", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// GET /api/reviews/:id — single review detail view.
router.get("/:id", async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: "Not found" });
  res.json(review);
});

module.exports = router;
