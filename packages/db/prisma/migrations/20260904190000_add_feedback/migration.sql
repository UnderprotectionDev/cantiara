-- CreateTable
CREATE TABLE IF NOT EXISTS "feedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalMessage" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "feedback_event" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "feedback_attachment" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "fileAttachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_projectId_idx" ON "feedback"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_projectId_status_idx" ON "feedback"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_event_feedbackId_occurredAt_idx" ON "feedback_event"("feedbackId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_attachment_feedbackId_idx" ON "feedback_attachment"("feedbackId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "feedback" ADD CONSTRAINT "feedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "feedback_event" ADD CONSTRAINT "feedback_event_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "feedback_attachment" ADD CONSTRAINT "feedback_attachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
