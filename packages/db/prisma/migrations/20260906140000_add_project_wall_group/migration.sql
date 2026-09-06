-- CreateTable
CREATE TABLE IF NOT EXISTS "project_wall_group" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_wall_group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_group_designId_sortOrder_idx" ON "project_wall_group"("designId", "sortOrder");

DO $$ BEGIN
    ALTER TABLE "project_wall_group" ADD CONSTRAINT "project_wall_group_designId_fkey" FOREIGN KEY ("designId") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
