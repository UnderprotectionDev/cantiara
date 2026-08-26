-- AlterTable
ALTER TABLE "capture_inbox_item" ADD COLUMN "link" TEXT NOT NULL DEFAULT '';
ALTER TABLE "capture_inbox_item" ADD COLUMN "attachmentRef" TEXT;
ALTER TABLE "capture_inbox_item" ADD COLUMN "origin" TEXT NOT NULL DEFAULT '';
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedAt" TIMESTAMP(3);
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedExit" TEXT;
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedTargetId" TEXT;
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedTargetKind" TEXT;
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedRelation" TEXT;
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedAttributedText" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "capture_inbox_item" ADD COLUMN "consumedMergeId" TEXT;

-- CreateIndex
CREATE INDEX "capture_inbox_item_workspaceId_consumedMergeId_idx" ON "capture_inbox_item"("workspaceId", "consumedMergeId");
