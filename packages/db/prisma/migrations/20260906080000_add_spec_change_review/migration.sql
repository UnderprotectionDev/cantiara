-- CreateTable
CREATE TABLE IF NOT EXISTS "spec_change_review" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "previousVersionId" TEXT NOT NULL,
    "newVersionId" TEXT NOT NULL,
    "previousRevision" INTEGER NOT NULL,
    "newRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spec_change_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "spec_change_review_featureId_previousVersionId_newVersionId_key" ON "spec_change_review"("featureId", "previousVersionId", "newVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spec_change_review_workspaceId_documentId_idx" ON "spec_change_review"("workspaceId", "documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spec_change_review_featureId_idx" ON "spec_change_review"("featureId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spec_change_review_workspaceId_fkey'
    ) THEN
        ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spec_change_review_featureId_fkey'
    ) THEN
        ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spec_change_review_documentId_fkey'
    ) THEN
        ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spec_change_review_previousVersionId_fkey'
    ) THEN
        ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spec_change_review_newVersionId_fkey'
    ) THEN
        ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_newVersionId_fkey" FOREIGN KEY ("newVersionId") REFERENCES "document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
