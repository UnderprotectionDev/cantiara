-- AlterTable
ALTER TABLE "project_wall_card" ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project_wall_card" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_wall_group" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_wall_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_wall_visual_link" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "fromCardId" TEXT NOT NULL,
    "toCardId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_wall_visual_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_card_groupId_idx" ON "project_wall_card"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_group_designId_idx" ON "project_wall_group"("designId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_wall_visual_link_designId_fromCardId_toCardId_key" ON "project_wall_visual_link"("designId", "fromCardId", "toCardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_visual_link_designId_idx" ON "project_wall_visual_link"("designId");

DO $$ BEGIN
    ALTER TABLE "project_wall_group" ADD CONSTRAINT "project_wall_group_designId_fkey" FOREIGN KEY ("designId") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_wall_card" ADD CONSTRAINT "project_wall_card_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "project_wall_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_wall_visual_link" ADD CONSTRAINT "project_wall_visual_link_designId_fkey" FOREIGN KEY ("designId") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_wall_visual_link" ADD CONSTRAINT "project_wall_visual_link_fromCardId_fkey" FOREIGN KEY ("fromCardId") REFERENCES "project_wall_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_wall_visual_link" ADD CONSTRAINT "project_wall_visual_link_toCardId_fkey" FOREIGN KEY ("toCardId") REFERENCES "project_wall_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
