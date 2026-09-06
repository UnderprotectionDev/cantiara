-- AlterTable
ALTER TABLE "project_wall_card" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_wall_personal_viewport" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "zoom" DOUBLE PRECISION NOT NULL,
    "collapsedGroupIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_wall_personal_viewport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_card_designId_sortOrder_idx" ON "project_wall_card"("designId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_wall_personal_viewport_designId_userId_key" ON "project_wall_personal_viewport"("designId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_personal_viewport_userId_idx" ON "project_wall_personal_viewport"("userId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "project_wall_personal_viewport" ADD CONSTRAINT "project_wall_personal_viewport_designId_fkey" FOREIGN KEY ("designId") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_wall_personal_viewport" ADD CONSTRAINT "project_wall_personal_viewport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
