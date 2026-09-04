-- CreateTable
CREATE TABLE IF NOT EXISTS "assumption" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "life" TEXT NOT NULL,
    "outcomeRationale" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assumption_event" (
    "id" TEXT NOT NULL,
    "assumptionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "rationale" TEXT,
    "previousLife" TEXT,
    "nextLife" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assumption_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assumption_projectId_idx" ON "assumption"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assumption_projectId_life_idx" ON "assumption"("projectId", "life");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assumption_event_assumptionId_occurredAt_idx" ON "assumption_event"("assumptionId", "occurredAt");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "assumption" ADD CONSTRAINT "assumption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "assumption_event" ADD CONSTRAINT "assumption_event_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "assumption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
