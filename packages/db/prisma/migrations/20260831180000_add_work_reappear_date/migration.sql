-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "reappearDate" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_projectId_reappearDate_idx" ON "work"("projectId", "reappearDate");
