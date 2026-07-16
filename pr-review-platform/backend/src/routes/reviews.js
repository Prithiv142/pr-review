const express = require("express");
const prisma = require("../db");
const { requireApiKey } = require("../auth");

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

// GET /api/reviews/:id — single review detail view.
router.get("/:id", async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: "Not found" });
  res.json(review);
});

module.exports = router;
