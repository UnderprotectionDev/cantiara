-- AlterTable
ALTER TABLE "workspace" ADD COLUMN IF NOT EXISTS "overviewLayout" JSONB NOT NULL DEFAULT '{}';
