-- CreateTable
CREATE TABLE IF NOT EXISTS "moodboard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "moodboard_visual" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "originKind" TEXT NOT NULL,
    "fileAttachmentVersionId" TEXT,
    "externalUrl" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_visual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_projectId_idx" ON "moodboard"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_visual_moodboardId_sortOrder_idx" ON "moodboard_visual"("moodboardId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_visual_fileAttachmentVersionId_idx" ON "moodboard_visual"("fileAttachmentVersionId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "moodboard" ADD CONSTRAINT "moodboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_visual" ADD CONSTRAINT "moodboard_visual_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_visual" ADD CONSTRAINT "moodboard_visual_fileAttachmentVersionId_fkey" FOREIGN KEY ("fileAttachmentVersionId") REFERENCES "file_attachment_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
