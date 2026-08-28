-- AlterTable
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "previewStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "previewAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "previewCause" TEXT;
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "previewSupportReference" TEXT;
ALTER TABLE "file_attachment_version" ADD COLUMN IF NOT EXISTS "previewDataWritten" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_version_contentHash_idx" ON "file_attachment_version"("contentHash");

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_image_derivative" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_image_derivative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "file_image_derivative_contentHash_size_key" ON "file_image_derivative"("contentHash", "size");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_image_derivative_contentHash_idx" ON "file_image_derivative"("contentHash");
