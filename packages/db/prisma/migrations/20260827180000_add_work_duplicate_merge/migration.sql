-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "retiredIntoId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "work_relation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "work_merge_event" (
    "id" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "retiredId" TEXT NOT NULL,
    "attributedFields" TEXT NOT NULL,
    "previousSurvivor" TEXT NOT NULL,
    "postMergeSurvivor" TEXT NOT NULL,
    "retiredSnapshot" TEXT NOT NULL,
    "movedRelations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_merge_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_retiredIntoId_idx" ON "work"("retiredIntoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_relation_fromId_idx" ON "work_relation"("fromId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_relation_toId_idx" ON "work_relation"("toId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_merge_event_survivorId_idx" ON "work_merge_event"("survivorId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_retiredIntoId_fkey'
    ) THEN
        ALTER TABLE "work" ADD CONSTRAINT "work_retiredIntoId_fkey" FOREIGN KEY ("retiredIntoId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_relation_fromId_fkey'
    ) THEN
        ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_relation_toId_fkey'
    ) THEN
        ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_merge_event_survivorId_fkey'
    ) THEN
        ALTER TABLE "work_merge_event" ADD CONSTRAINT "work_merge_event_survivorId_fkey" FOREIGN KEY ("survivorId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_merge_event_retiredId_fkey'
    ) THEN
        ALTER TABLE "work_merge_event" ADD CONSTRAINT "work_merge_event_retiredId_fkey" FOREIGN KEY ("retiredId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;
