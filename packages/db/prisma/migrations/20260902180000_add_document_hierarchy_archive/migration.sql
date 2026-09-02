-- AlterTable
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "folderId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_folder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_workspaceId_archivedAt_idx" ON "document"("workspaceId", "archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_parentId_idx" ON "document"("parentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_folderId_idx" ON "document"("folderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_folder_workspaceId_scopeKind_projectId_idx" ON "document_folder"("workspaceId", "scopeKind", "projectId");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "document_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folder" ADD CONSTRAINT "document_folder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folder" ADD CONSTRAINT "document_folder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
