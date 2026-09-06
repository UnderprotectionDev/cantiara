-- CreateTable
CREATE TABLE IF NOT EXISTS "screen" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "trashedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "wireframe_version" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wireframe_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "screen_event" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_projectId_idx" ON "screen"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_projectId_trashedAt_archivedAt_idx" ON "screen"("projectId", "trashedAt", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wireframe_version_screenId_versionNumber_key" ON "wireframe_version"("screenId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wireframe_version_screenId_idx" ON "wireframe_version"("screenId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_event_screenId_occurredAt_idx" ON "screen_event"("screenId", "occurredAt");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "screen" ADD CONSTRAINT "screen_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "wireframe_version" ADD CONSTRAINT "wireframe_version_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "screen_event" ADD CONSTRAINT "screen_event_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
