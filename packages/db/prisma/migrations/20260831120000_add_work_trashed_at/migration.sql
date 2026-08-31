-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "trashedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_projectId_trashedAt_idx" ON "work"("projectId", "trashedAt");
