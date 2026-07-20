# Automated PR Review + Dashboard

Automatically reviews PRs opened against enabled target branches (e.g. `Dev`)
in `PolicyManagementSPFx`, runs static checks (ESLint/tsc/build) plus an
AI-based review (Claude), posts the findings as a PR comment, and stores
every run in a dashboard you can filter by source branch.

Non-blocking (comment only) — no merges are ever blocked by this.

## Manual mode (no repo changes required)

If you **cannot** add a GitHub Action to the target repo (e.g. company policy),
use **Run review** on the dashboard instead:

1. Enable the target branch in **Settings** (e.g. `Dev`)
2. Add these env vars on **Render** (backend):
   - `GITHUB_TOKEN` — PAT with `repo` + `write:discussion` or `public_repo` + issues write for public repos
   - `ANTHROPIC_API_KEY`
   - `AZURE_DEVOPS_ORG` / `AZURE_DEVOPS_PAT` (optional, for bug verification)
3. Open **Run review**, paste the PR URL, click **Run review**
4. Results appear on the dashboard and as a comment on the PR

No workflow files or secrets are needed in PolicyManagementSPFx.

## How it fits together (automatic mode — optional)

```
GitHub PR (branch → Dev)
  → GitHub Action (.github/workflows/pr-review.yml)
      → checkEligibility.js   (asks backend: is "Dev" enabled?)
      → staticChecks.js       (ESLint, tsc, build)
      → aiReview.js           (Claude API on the diff)
      → sendResults.js        (POST /api/reviews to backend)
      → postComment.js        (creates/updates one PR comment)
  → Backend (Render, Node/Express + Prisma + Postgres)
  → Dashboard (Vercel, Next.js) — reads from backend, filter by branch,
    toggle which branches are eligible
```

## 1. Database

Use any hosted Postgres — **Supabase** or **Neon** free tier is enough to start.

```
cd backend
cp .env.example .env   # fill in DATABASE_URL and API_KEY
npm install
npx prisma migrate deploy
```

## 2. Backend (deploy to Render)

- Push `backend/` as its own service (or a monorepo with a root directory set to `backend`).
- Build command: `npm install && npx prisma generate`
- Start command: `npm start`
- Environment variables: `DATABASE_URL`, `DIRECT_URL`, `API_KEY`, `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PAT` (last three for manual reviews / bug verification)
- After first deploy, run `npx prisma migrate deploy` once (Render shell or a one-off job) to create tables.

Once deployed you'll have a URL like `https://pr-review-backend.onrender.com`.

## 3. Dashboard (deploy to Vercel)

- Import `dashboard/` as a Vercel project (root directory: `dashboard`).
- Environment variables:
  - `NEXT_PUBLIC_BACKEND_URL` = your Render backend URL
  - `BACKEND_API_KEY` = same value as the backend's `API_KEY`
- Deploy. Visit `/settings` first to add and enable `Dev` (and any other branches you want reviewed) — branches are disabled by default.

## 4. GitHub Action

In `PolicyManagementSPFx`, add these repo secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `REVIEW_BACKEND_URL` | your Render backend URL |
| `REVIEW_BACKEND_API_KEY` | same API key as above |
| `ANTHROPIC_API_KEY` | your Anthropic API key |
| `AZURE_DEVOPS_ORG` | your ADO organization name (from `dev.azure.com/{org}`) |
| `AZURE_DEVOPS_PAT` | a PAT with **Work Items (Read)** scope |

`GITHUB_TOKEN` is provided automatically by Actions — no setup needed.

Copy `.github/workflows/pr-review.yml` and the `scripts/review/` folder into
the `PolicyManagementSPFx` repo, commit, and open a test PR into `Dev`.

## Bug fix verification

If the PR title contains a work item ID (`AB#1234`, `[1234]`, `Bug 1234`, or
just `#1234`), the AI review step fetches that work item from Azure DevOps
and checks whether the diff plausibly addresses its description — not just
"does it compile," but "does it actually fix what the bug says is wrong."

The result shows up as its own section in the PR comment (verdict:
**likely fixed** / **likely not fixed** / **unclear**, with a short
explanation) and as a column in the dashboard. If your team uses a
different title convention, set the `BUG_ID_REGEX` secret/variable to a
custom regex (first capture group = the numeric ID) instead of relying on
the built-in patterns.

This is informational only, same as everything else here — it doesn't
block the merge, it just gives the human reviewer a head start on whether
the PR does what it claims to.

## Notes on scope

- **Non-blocking today.** If the team later wants failed reviews to block
  merges, that's a separate step: add the workflow as a required status
  check in branch protection rules. Nothing else in this setup needs to
  change for that.
- **Single repo for now.** The schema already has a `repo` field on every
  review row, so adding a second repo later just means pointing its Action
  at the same backend — no schema changes needed.
- **Fail-closed eligibility.** If the backend is unreachable or a branch has
  no config entry, the Action treats it as *not eligible* rather than
  silently reviewing everything — avoids surprise API costs or noise if the
  backend has an outage.
