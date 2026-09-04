-- CreateTable
CREATE TABLE IF NOT EXISTS "open_question" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "life" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "open_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "open_question_event" (
    "id" TEXT NOT NULL,
    "openQuestionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "rationale" TEXT,
    "previousLife" TEXT,
    "nextLife" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_question_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "open_question_projectId_idx" ON "open_question"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "open_question_projectId_life_idx" ON "open_question"("projectId", "life");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "open_question_event_openQuestionId_occurredAt_idx" ON "open_question_event"("openQuestionId", "occurredAt");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "open_question" ADD CONSTRAINT "open_question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "open_question_event" ADD CONSTRAINT "open_question_event_openQuestionId_fkey" FOREIGN KEY ("openQuestionId") REFERENCES "open_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
