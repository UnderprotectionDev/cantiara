-- CreateTable
CREATE TABLE IF NOT EXISTS "design" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_wall_card" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "density" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_wall_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "design_projectId_type_idx" ON "design"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_wall_card_designId_sourceId_key" ON "project_wall_card"("designId", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_card_designId_idx" ON "project_wall_card"("designId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_wall_card_sourceId_idx" ON "project_wall_card"("sourceId");

DO $$ BEGIN
    ALTER TABLE "design" ADD CONSTRAINT "design_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_wall_card" ADD CONSTRAINT "project_wall_card_designId_fkey" FOREIGN KEY ("designId") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
