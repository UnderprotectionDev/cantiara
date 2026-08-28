-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "lifecycle" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment_version" (
    "id" TEXT NOT NULL,
    "fileAttachmentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachment_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment_version_pin" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachment_version_pin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment_relation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachment_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment_staging" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "commandKey" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL,
    "projectId" TEXT,
    "targetFileAttachmentId" TEXT,
    "filename" TEXT NOT NULL,
    "declaredMime" TEXT NOT NULL,
    "expectedByteLength" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bytesComplete" BOOLEAN NOT NULL DEFAULT false,
    "committedAttachmentId" TEXT,
    "committedVersionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_attachment_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_attachment_receipt" (
    "id" TEXT NOT NULL,
    "commandKey" TEXT NOT NULL,
    "fileAttachmentId" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachment_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_object_blob" (
    "objectKey" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "accessible" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_object_blob_pkey" PRIMARY KEY ("objectKey")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_workspaceId_scopeKind_projectId_idx" ON "file_attachment"("workspaceId", "scopeKind", "projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_workspaceId_lifecycle_idx" ON "file_attachment"("workspaceId", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "file_attachment_version_fileAttachmentId_versionNumber_key" ON "file_attachment_version"("fileAttachmentId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_version_fileAttachmentId_idx" ON "file_attachment_version"("fileAttachmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_version_pin_versionId_idx" ON "file_attachment_version_pin"("versionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_relation_fromId_idx" ON "file_attachment_relation"("fromId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "file_attachment_staging_commandKey_key" ON "file_attachment_staging"("commandKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_staging_workspaceId_status_expiresAt_idx" ON "file_attachment_staging"("workspaceId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "file_attachment_receipt_commandKey_key" ON "file_attachment_receipt"("commandKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_attachment_receipt_fileAttachmentId_idx" ON "file_attachment_receipt"("fileAttachmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "file_object_blob_workspaceId_accessible_idx" ON "file_object_blob"("workspaceId", "accessible");

-- AddForeignKey
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachment_version" ADD CONSTRAINT "file_attachment_version_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "file_attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachment_version_pin" ADD CONSTRAINT "file_attachment_version_pin_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "file_attachment_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachment_relation" ADD CONSTRAINT "file_attachment_relation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "file_attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachment_receipt" ADD CONSTRAINT "file_attachment_receipt_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "file_attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
