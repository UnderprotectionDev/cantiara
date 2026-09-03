-- CreateTable
CREATE TABLE IF NOT EXISTS "decision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decisionText" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "life" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnRationale" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "decision_event" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "rationale" TEXT,
    "previousLife" TEXT,
    "nextLife" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "decision_projectId_idx" ON "decision"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "decision_projectId_life_idx" ON "decision"("projectId", "life");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "decision_event_decisionId_occurredAt_idx" ON "decision_event"("decisionId", "occurredAt");

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_event" ADD CONSTRAINT "decision_event_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
