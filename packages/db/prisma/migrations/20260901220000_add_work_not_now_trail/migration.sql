-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "notNowReviewLaterIds" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE IF NOT EXISTS "work_not_now_trail" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reevaluationCondition" TEXT,
    "grounds" JSONB NOT NULL DEFAULT '[]',
    "state" TEXT NOT NULL,
    "closeAction" TEXT,
    "actorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_not_now_trail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_not_now_trail_workId_state_idx" ON "work_not_now_trail"("workId", "state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_not_now_trail_workId_recordedAt_idx" ON "work_not_now_trail"("workId", "recordedAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'work_not_now_trail_workId_fkey'
    ) THEN
        ALTER TABLE "work_not_now_trail"
        ADD CONSTRAINT "work_not_now_trail_workId_fkey"
        FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
