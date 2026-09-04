-- CreateTable
CREATE TABLE IF NOT EXISTS "risk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "probability" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "acceptanceRationale" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_event" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "rationale" TEXT,
    "previousStatus" TEXT,
    "nextStatus" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "risk_projectId_idx" ON "risk"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "risk_projectId_status_idx" ON "risk"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "risk_event_riskId_occurredAt_idx" ON "risk_event"("riskId", "occurredAt");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "risk" ADD CONSTRAINT "risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "risk_event" ADD CONSTRAINT "risk_event_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
