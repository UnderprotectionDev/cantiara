-- CreateTable
CREATE TABLE "capture_inbox_item" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "template" TEXT,
    "fieldsText" TEXT NOT NULL DEFAULT '{}',
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_inbox_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_write_receipt" (
    "id" TEXT NOT NULL,
    "commandKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_write_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capture_inbox_item_workspaceId_projectId_capturedAt_idx" ON "capture_inbox_item"("workspaceId", "projectId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "capture_write_receipt_commandKey_key" ON "capture_write_receipt"("commandKey");
