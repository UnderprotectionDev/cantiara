-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_attention_signal" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceEventKind" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "probability" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_attention_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "risk_related_record" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "inPublishPrep" BOOLEAN,
    "releaseStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_related_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "risk_attention_signal_signalId_sourceEventId_key" ON "risk_attention_signal"("signalId", "sourceEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "risk_attention_signal_riskId_idx" ON "risk_attention_signal"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "risk_related_record_riskId_targetKind_targetId_key" ON "risk_related_record"("riskId", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "risk_related_record_riskId_idx" ON "risk_related_record"("riskId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "risk_attention_signal" ADD CONSTRAINT "risk_attention_signal_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "risk_related_record" ADD CONSTRAINT "risk_related_record_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
