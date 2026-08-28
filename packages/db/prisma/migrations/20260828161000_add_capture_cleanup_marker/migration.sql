ALTER TABLE "capture_inbox_item"
ADD COLUMN "stagingCleanupStatus" TEXT,
ADD COLUMN "stagingCleanupError" TEXT,
ADD COLUMN "stagingCleanupAt" TIMESTAMP(3);
