-- AlterTable
ALTER TABLE "focus_period" ADD COLUMN "closeStillOpenWorkIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "focus_period" ADD COLUMN "closeCompletedWorkIds" JSONB NOT NULL DEFAULT '[]';
