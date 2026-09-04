-- CreateTable
CREATE TABLE IF NOT EXISTS "feedback_evidence_link" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "reportedProblem" TEXT NOT NULL DEFAULT '',
    "suggestedSolution" TEXT NOT NULL DEFAULT '',
    "currentWorkaround" TEXT NOT NULL DEFAULT '',
    "impactSeverity" TEXT NOT NULL DEFAULT '',
    "usageFrequency" TEXT NOT NULL DEFAULT '',
    "independence" TEXT NOT NULL DEFAULT '',
    "audienceFit" TEXT NOT NULL DEFAULT '',
    "evidenceRole" TEXT NOT NULL DEFAULT 'Unspecified',
    "followUp" TEXT,
    "interpretationActorId" TEXT,
    "interpretationSetAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_evidence_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_evidence_link_relationId_key" ON "feedback_evidence_link"("relationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_evidence_link_feedbackId_workId_key" ON "feedback_evidence_link"("feedbackId", "workId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_evidence_link_feedbackId_idx" ON "feedback_evidence_link"("feedbackId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_evidence_link_workId_idx" ON "feedback_evidence_link"("workId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "feedback_evidence_link" ADD CONSTRAINT "feedback_evidence_link_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "feedback_evidence_link" ADD CONSTRAINT "feedback_evidence_link_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
