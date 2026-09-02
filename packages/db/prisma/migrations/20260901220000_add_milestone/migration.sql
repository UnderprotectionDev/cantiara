-- CreateTable
CREATE TABLE IF NOT EXISTS "milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TEXT,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "milestone_status_event" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "previousStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "milestone_projectId_idx" ON "milestone"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "milestone_projectId_status_idx" ON "milestone"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "milestone_status_event_milestoneId_createdAt_idx" ON "milestone_status_event"("milestoneId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'milestone_projectId_fkey'
    ) THEN
        ALTER TABLE "milestone"
        ADD CONSTRAINT "milestone_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'milestone_status_event_milestoneId_fkey'
    ) THEN
        ALTER TABLE "milestone_status_event"
        ADD CONSTRAINT "milestone_status_event_milestoneId_fkey"
        FOREIGN KEY ("milestoneId") REFERENCES "milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
