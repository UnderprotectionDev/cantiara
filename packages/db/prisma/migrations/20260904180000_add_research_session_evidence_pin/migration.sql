-- CreateTable
CREATE TABLE IF NOT EXISTS "research_session_evidence_pin" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "pinnedRevision" INTEGER NOT NULL,
    "rangeStart" INTEGER NOT NULL,
    "rangeEnd" INTEGER NOT NULL,
    "excerpt" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_session_evidence_pin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_evidence_pin_sessionId_idx" ON "research_session_evidence_pin"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_evidence_pin_noteId_idx" ON "research_session_evidence_pin"("noteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_evidence_pin_targetId_targetKind_idx" ON "research_session_evidence_pin"("targetId", "targetKind");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- leave `_prisma_migrations` failed.)
DO $$
BEGIN
    ALTER TABLE "research_session_evidence_pin" ADD CONSTRAINT "research_session_evidence_pin_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "research_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
