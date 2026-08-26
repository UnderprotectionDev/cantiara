-- CreateTable
CREATE TABLE "capture_bulk_sense_view" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "layoutText" TEXT NOT NULL DEFAULT '{"clusters":[],"placements":[]}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_bulk_sense_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capture_bulk_sense_view_workspaceId_ownerId_key" ON "capture_bulk_sense_view"("workspaceId", "ownerId");
