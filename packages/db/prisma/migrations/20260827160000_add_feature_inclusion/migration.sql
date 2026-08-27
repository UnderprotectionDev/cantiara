-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "includedInFeatureId" TEXT;
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "primarySpecId" TEXT;
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "primarySpecTitle" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "feature_health_update" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_health_update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "work_related_edge" (
    "id" TEXT NOT NULL,
    "fromWorkId" TEXT NOT NULL,
    "toWorkId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_related_edge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_includedInFeatureId_idx" ON "work"("includedInFeatureId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feature_health_update_featureId_createdAt_idx" ON "feature_health_update"("featureId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "work_related_edge_fromWorkId_toWorkId_kind_key" ON "work_related_edge"("fromWorkId", "toWorkId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_related_edge_toWorkId_idx" ON "work_related_edge"("toWorkId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_includedInFeatureId_fkey'
    ) THEN
        ALTER TABLE "work" ADD CONSTRAINT "work_includedInFeatureId_fkey" FOREIGN KEY ("includedInFeatureId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feature_health_update_featureId_fkey'
    ) THEN
        ALTER TABLE "feature_health_update" ADD CONSTRAINT "feature_health_update_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_related_edge_fromWorkId_fkey'
    ) THEN
        ALTER TABLE "work_related_edge" ADD CONSTRAINT "work_related_edge_fromWorkId_fkey" FOREIGN KEY ("fromWorkId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_related_edge_toWorkId_fkey'
    ) THEN
        ALTER TABLE "work_related_edge" ADD CONSTRAINT "work_related_edge_toWorkId_fkey" FOREIGN KEY ("toWorkId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;
