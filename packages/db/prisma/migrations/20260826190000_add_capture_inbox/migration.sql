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

-- CreateIndex
CREATE INDEX "capture_inbox_item_workspaceId_projectId_capturedAt_idx" ON "capture_inbox_item"("workspaceId", "projectId", "capturedAt");
