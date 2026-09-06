-- CreateTable
CREATE TABLE IF NOT EXISTS "moodboard_palette_group" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_palette_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "moodboard_color_swatch" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "paletteGroupId" TEXT,
    "hex" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sourceKind" TEXT NOT NULL,
    "sourceVisualId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_color_swatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_palette_group_moodboardId_sortOrder_idx" ON "moodboard_palette_group"("moodboardId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_color_swatch_moodboardId_sortOrder_idx" ON "moodboard_color_swatch"("moodboardId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_color_swatch_paletteGroupId_sortOrder_idx" ON "moodboard_color_swatch"("paletteGroupId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "moodboard_color_swatch_sourceVisualId_idx" ON "moodboard_color_swatch"("sourceVisualId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "moodboard_palette_group" ADD CONSTRAINT "moodboard_palette_group_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_color_swatch" ADD CONSTRAINT "moodboard_color_swatch_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_color_swatch" ADD CONSTRAINT "moodboard_color_swatch_paletteGroupId_fkey" FOREIGN KEY ("paletteGroupId") REFERENCES "moodboard_palette_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "moodboard_color_swatch" ADD CONSTRAINT "moodboard_color_swatch_sourceVisualId_fkey" FOREIGN KEY ("sourceVisualId") REFERENCES "moodboard_visual"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
