-- CreateTable
CREATE TABLE "work_draft" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "customFieldValuesText" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_draft_workspaceId_ownerId_updatedAt_idx" ON "work_draft"("workspaceId", "ownerId", "updatedAt");
