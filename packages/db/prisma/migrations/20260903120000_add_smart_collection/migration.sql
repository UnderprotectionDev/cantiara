-- CreateTable
CREATE TABLE IF NOT EXISTS "smart_collection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_collection_workspaceId_idx" ON "smart_collection"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_collection_projectId_idx" ON "smart_collection"("projectId");

-- AddForeignKey
ALTER TABLE "smart_collection" ADD CONSTRAINT "smart_collection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_collection" ADD CONSTRAINT "smart_collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
