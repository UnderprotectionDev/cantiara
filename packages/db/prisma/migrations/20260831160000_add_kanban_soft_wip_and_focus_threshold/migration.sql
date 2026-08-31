-- AlterTable
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "focusThreshold" INTEGER;

-- AlterTable
ALTER TABLE "project_work_status" ADD COLUMN IF NOT EXISTS "softWipLimit" INTEGER;

