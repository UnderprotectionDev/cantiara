-- CreateTable
CREATE TABLE IF NOT EXISTS "smart_collection_named_view" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "presentation" TEXT NOT NULL,
    "groupField" TEXT,
    "sortField" TEXT,
    "sortDirection" TEXT,
    "filterText" TEXT NOT NULL DEFAULT '',
    "visibleFields" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_collection_named_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "smart_collection_named_view_collectionId_name_key" ON "smart_collection_named_view"("collectionId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_collection_named_view_collectionId_idx" ON "smart_collection_named_view"("collectionId");

-- AddForeignKey
ALTER TABLE "smart_collection_named_view" ADD CONSTRAINT "smart_collection_named_view_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "smart_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
