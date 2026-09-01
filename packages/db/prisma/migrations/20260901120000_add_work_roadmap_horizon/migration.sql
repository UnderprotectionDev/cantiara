-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "horizon" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_projectId_horizon_idx" ON "work"("projectId", "horizon");

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_roadmap_named_view" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presentation" TEXT NOT NULL,
    "groupField" TEXT,
    "horizonFilter" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_roadmap_named_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_roadmap_named_view_projectId_name_key" ON "project_roadmap_named_view"("projectId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_roadmap_named_view_projectId_idx" ON "project_roadmap_named_view"("projectId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'project_roadmap_named_view_projectId_fkey'
    ) THEN
        ALTER TABLE "project_roadmap_named_view"
        ADD CONSTRAINT "project_roadmap_named_view_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
