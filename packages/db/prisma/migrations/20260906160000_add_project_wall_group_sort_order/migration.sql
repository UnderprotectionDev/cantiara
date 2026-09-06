ALTER TABLE "project_wall_group" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "project_wall_group_designId_sortOrder_idx" ON "project_wall_group"("designId", "sortOrder");
