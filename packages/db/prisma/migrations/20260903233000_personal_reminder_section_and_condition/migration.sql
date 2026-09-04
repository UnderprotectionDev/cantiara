-- AlterTable
ALTER TABLE "personal_reminder" ADD COLUMN "documentSectionId" TEXT;
ALTER TABLE "personal_reminder" ADD COLUMN "stillOpenCondition" TEXT NOT NULL DEFAULT 'In any case';
