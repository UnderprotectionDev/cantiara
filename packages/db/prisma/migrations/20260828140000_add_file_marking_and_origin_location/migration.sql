-- AlterTable
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "markingMarks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "shareItemApprovals" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment_origin_location" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachment_origin_location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_origin_location_versionId_idx" ON "file_attachment_origin_location"("versionId");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "file_attachment_origin_location"
        ADD CONSTRAINT "file_attachment_origin_location_versionId_fkey"
        FOREIGN KEY ("versionId") REFERENCES "file_attachment_version"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
