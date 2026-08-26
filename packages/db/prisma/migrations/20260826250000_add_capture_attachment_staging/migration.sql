-- CreateTable
CREATE TABLE "capture_staging_object" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "wrappedDek" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_staging_object_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capture_staging_object_inboxItemId_key" ON "capture_staging_object"("inboxItemId");

-- CreateIndex
CREATE INDEX "capture_staging_object_workspaceId_idx" ON "capture_staging_object"("workspaceId");

-- AddForeignKey
ALTER TABLE "capture_staging_object" ADD CONSTRAINT "capture_staging_object_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "capture_inbox_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
