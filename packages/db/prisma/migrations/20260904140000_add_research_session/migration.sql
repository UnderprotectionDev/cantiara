-- CreateTable
CREATE TABLE IF NOT EXISTS "research_session" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "questionGuide" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "channel" TEXT NOT NULL,
    "facilitator" TEXT NOT NULL,
    "scopeNote" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "consent" TEXT NOT NULL,
    "consentNote" TEXT NOT NULL,
    "consentRecordedByUserId" TEXT NOT NULL,
    "consentRecordedAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "research_session_note" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "speakerLabel" TEXT,
    "capturedUnderConsent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_session_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "research_session_file" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileAttachmentId" TEXT NOT NULL,
    "capturedUnderConsent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_session_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "research_session_event" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previous" TEXT,
    "next" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_session_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_projectId_idx" ON "research_session"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_projectId_status_idx" ON "research_session"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_projectId_consent_idx" ON "research_session"("projectId", "consent");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_note_sessionId_idx" ON "research_session_note"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_file_sessionId_idx" ON "research_session_file"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_session_event_sessionId_occurredAt_idx" ON "research_session_event"("sessionId", "occurredAt");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "research_session" ADD CONSTRAINT "research_session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "research_session_note" ADD CONSTRAINT "research_session_note_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "research_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "research_session_file" ADD CONSTRAINT "research_session_file_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "research_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "research_session_event" ADD CONSTRAINT "research_session_event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "research_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
