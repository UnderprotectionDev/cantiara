-- CreateTable
CREATE TABLE IF NOT EXISTS "document_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "document_version_documentId_revision_key" ON "document_version"("documentId", "revision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_version_documentId_idx" ON "document_version"("documentId");

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill application versions from the current Document tip.
INSERT INTO "document_version" ("id", "documentId", "revision", "title", "body", "type", "createdAt")
SELECT gen_random_uuid()::text, "id", "revision", "title", "body", "type", "createdAt"
FROM "document"
WHERE NOT EXISTS (
    SELECT 1
    FROM "document_version"
    WHERE "document_version"."documentId" = "document"."id"
      AND "document_version"."revision" = "document"."revision"
);
