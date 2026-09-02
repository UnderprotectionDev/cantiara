-- CreateTable
CREATE TABLE IF NOT EXISTS "document" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_workspaceId_scopeKind_projectId_idx" ON "document"("workspaceId", "scopeKind", "projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_workspaceId_updatedAt_idx" ON "document"("workspaceId", "updatedAt");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
