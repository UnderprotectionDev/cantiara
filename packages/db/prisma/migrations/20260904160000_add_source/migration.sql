-- CreateTable
CREATE TABLE IF NOT EXISTS "source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "approvedVersionNumber" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "source_version" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    "capturedContent" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "provider" TEXT,
    "externalRecordType" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_projectId_idx" ON "source"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "source_version_sourceId_versionNumber_key" ON "source_version"("sourceId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_version_sourceId_idx" ON "source_version"("sourceId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "source" ADD CONSTRAINT "source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "source_version" ADD CONSTRAINT "source_version_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
