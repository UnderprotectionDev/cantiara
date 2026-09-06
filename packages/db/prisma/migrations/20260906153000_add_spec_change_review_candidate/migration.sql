-- CreateTable
CREATE TABLE IF NOT EXISTS "spec_change_review_candidate" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordKind" TEXT NOT NULL,
    "why" JSONB NOT NULL,
    "documentLevel" BOOLEAN NOT NULL,
    "changedSection" TEXT,
    "reviewStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spec_change_review_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "spec_change_review_candidate_reviewId_recordKind_recordId_key" ON "spec_change_review_candidate"("reviewId", "recordKind", "recordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spec_change_review_candidate_reviewId_idx" ON "spec_change_review_candidate"("reviewId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spec_change_review_candidate_reviewId_fkey'
    ) THEN
        ALTER TABLE "spec_change_review_candidate" ADD CONSTRAINT "spec_change_review_candidate_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "spec_change_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
