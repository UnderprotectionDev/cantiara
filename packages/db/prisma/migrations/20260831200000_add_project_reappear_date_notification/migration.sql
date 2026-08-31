-- AlterTable
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "reappearDateNotification" BOOLEAN NOT NULL DEFAULT false;
