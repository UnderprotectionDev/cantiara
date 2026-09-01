-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "plannedStart" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_projectId_plannedStart_idx" ON "work"("projectId", "plannedStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_projectId_targetDate_idx" ON "work"("projectId", "targetDate");
