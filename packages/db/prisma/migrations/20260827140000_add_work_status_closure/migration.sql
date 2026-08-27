-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "closureResult" TEXT;
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "closureReason" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "work_lifecycle_event" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "closureResult" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_lifecycle_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_lifecycle_event_workId_createdAt_idx" ON "work_lifecycle_event"("workId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_lifecycle_event_workId_fkey'
    ) THEN
        ALTER TABLE "work_lifecycle_event" ADD CONSTRAINT "work_lifecycle_event_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;
