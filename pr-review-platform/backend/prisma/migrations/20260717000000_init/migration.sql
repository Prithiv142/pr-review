-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "bugId" TEXT,
    "bugFixVerification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchConfig" (
    "branchName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchConfig_pkey" PRIMARY KEY ("branchName")
);

-- CreateIndex
CREATE INDEX "Review_targetBranch_idx" ON "Review"("targetBranch");

-- CreateIndex
CREATE INDEX "Review_sourceBranch_idx" ON "Review"("sourceBranch");

-- CreateIndex
CREATE INDEX "Review_prNumber_idx" ON "Review"("prNumber");
