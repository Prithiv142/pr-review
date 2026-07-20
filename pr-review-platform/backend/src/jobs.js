// In-memory job tracker for long-running manual reviews.
// Jobs are lost if the server restarts — fine for MVP on Render free tier.

const jobs = new Map();

function createJob(prUrl) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    prUrl,
    status: "pending",
    review: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

module.exports = { createJob, updateJob, getJob };
