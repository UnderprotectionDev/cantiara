-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_projectId_archived_idx" ON "work"("projectId", "archived");
