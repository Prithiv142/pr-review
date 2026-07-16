const express = require("express");
const prisma = require("../db");
const { requireApiKey } = require("../auth");

const router = express.Router();

// GET /api/config/branches — full list, for the dashboard settings page.
router.get("/", async (req, res) => {
  const branches = await prisma.branchConfig.findMany({ orderBy: { branchName: "asc" } });
  res.json(branches);
});

// GET /api/config/branches/:branchName — called by checkEligibility.js in CI.
// No auth required for reads so the GitHub Action can check quickly; only
// writes are gated. Adjust if branch names should be kept private.
router.get("/:branchName", async (req, res) => {
  const config = await prisma.branchConfig.findUnique({
    where: { branchName: req.params.branchName },
  });

  if (!config) return res.status(404).json({ error: "No config for this branch" });
  res.json(config);
});

// PUT /api/config/branches/:branchName — toggle eligibility from the dashboard.
router.put("/:branchName", requireApiKey, async (req, res) => {
  const { isEnabled } = req.body;

  if (typeof isEnabled !== "boolean") {
    return res.status(400).json({ error: "isEnabled must be a boolean" });
  }

  const config = await prisma.branchConfig.upsert({
    where: { branchName: req.params.branchName },
    update: { isEnabled },
    create: { branchName: req.params.branchName, isEnabled },
  });

  res.json(config);
});

// DELETE /api/config/branches/:branchName — remove a branch from the list entirely.
router.delete("/:branchName", requireApiKey, async (req, res) => {
  await prisma.branchConfig.delete({ where: { branchName: req.params.branchName } }).catch(() => {});
  res.status(204).send();
});

module.exports = router;
