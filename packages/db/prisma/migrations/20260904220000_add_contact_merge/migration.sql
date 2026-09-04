-- AlterTable
ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "retiredIntoId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_retiredIntoId_idx" ON "contact"("retiredIntoId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_retiredIntoId_fkey'
    ) THEN
        ALTER TABLE "contact" ADD CONSTRAINT "contact_retiredIntoId_fkey" FOREIGN KEY ("retiredIntoId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "contact_merge_event" (
    "id" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "retiredId" TEXT NOT NULL,
    "attributedFields" TEXT NOT NULL,
    "previousSurvivor" TEXT NOT NULL,
    "postMergeSurvivor" TEXT NOT NULL,
    "retiredSnapshot" TEXT NOT NULL,
    "movedRelations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_merge_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_merge_event_survivorId_idx" ON "contact_merge_event"("survivorId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_merge_event_survivorId_fkey'
    ) THEN
        ALTER TABLE "contact_merge_event" ADD CONSTRAINT "contact_merge_event_survivorId_fkey" FOREIGN KEY ("survivorId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_merge_event_retiredId_fkey'
    ) THEN
        ALTER TABLE "contact_merge_event" ADD CONSTRAINT "contact_merge_event_retiredId_fkey" FOREIGN KEY ("retiredId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
