-- CreateTable
CREATE TABLE IF NOT EXISTS "document_template" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "skeleton" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_template_workspaceId_scopeKind_projectId_idx" ON "document_template"("workspaceId", "scopeKind", "projectId");

-- AddForeignKey
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
