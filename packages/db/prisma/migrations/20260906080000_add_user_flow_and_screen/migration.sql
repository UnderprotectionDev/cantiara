-- CreateTable
CREATE TABLE IF NOT EXISTS "screen" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "trashedAt" TIMESTAMP(3),
    "redactedAt" TIMESTAMP(3),
    "currentWireframeVersionId" TEXT,
    "wireframeVersionsJson" TEXT NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_flow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_flow_version" (
    "id" TEXT NOT NULL,
    "userFlowId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "document" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_flow_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_projectId_idx" ON "screen"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_projectId_archivedAt_idx" ON "screen"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_projectId_trashedAt_idx" ON "screen"("projectId", "trashedAt");

-- Fresh DBs apply this migration before 20260906120000_add_screen.
-- Hosted DBs that already have main's screen table still need User Flow
-- preview/redact columns used by live Screen refs.
ALTER TABLE "screen" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL DEFAULT '';
ALTER TABLE "screen" ADD COLUMN IF NOT EXISTS "redactedAt" TIMESTAMP(3);
ALTER TABLE "screen" ADD COLUMN IF NOT EXISTS "currentWireframeVersionId" TEXT;
ALTER TABLE "screen" ADD COLUMN IF NOT EXISTS "wireframeVersionsJson" TEXT NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_flow_projectId_idx" ON "user_flow"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_flow_projectId_updatedAt_idx" ON "user_flow"("projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_flow_version_userFlowId_revision_key" ON "user_flow_version"("userFlowId", "revision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_flow_version_userFlowId_idx" ON "user_flow_version"("userFlowId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'screen_projectId_fkey'
    ) THEN
        ALTER TABLE "screen" ADD CONSTRAINT "screen_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_flow_projectId_fkey'
    ) THEN
        ALTER TABLE "user_flow" ADD CONSTRAINT "user_flow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_flow_version_userFlowId_fkey'
    ) THEN
        ALTER TABLE "user_flow_version" ADD CONSTRAINT "user_flow_version_userFlowId_fkey" FOREIGN KEY ("userFlowId") REFERENCES "user_flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
