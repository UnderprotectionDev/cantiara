-- CreateTable
CREATE TABLE IF NOT EXISTS "moodboard_group" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_group_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "moodboard_visual" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "moodboard_personal_viewport" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "zoom" DOUBLE PRECISION NOT NULL,
    "collapsedGroupIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_personal_viewport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_group_moodboardId_sortOrder_idx" ON "moodboard_group"("moodboardId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_visual_groupId_idx" ON "moodboard_visual"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "moodboard_personal_viewport_moodboardId_userId_key" ON "moodboard_personal_viewport"("moodboardId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_personal_viewport_userId_idx" ON "moodboard_personal_viewport"("userId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "moodboard_group" ADD CONSTRAINT "moodboard_group_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_visual" ADD CONSTRAINT "moodboard_visual_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "moodboard_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_personal_viewport" ADD CONSTRAINT "moodboard_personal_viewport_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_personal_viewport" ADD CONSTRAINT "moodboard_personal_viewport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
