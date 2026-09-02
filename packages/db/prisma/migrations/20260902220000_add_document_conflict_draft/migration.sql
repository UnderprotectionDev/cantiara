-- CreateTable
CREATE TABLE IF NOT EXISTS "document_conflict_draft" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rejectedBaseRevision" INTEGER NOT NULL,
    "documentRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_conflict_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "document_conflict_draft_documentId_key" ON "document_conflict_draft"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_conflict_draft_workspaceId_idx" ON "document_conflict_draft"("workspaceId");

-- AddForeignKey
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
