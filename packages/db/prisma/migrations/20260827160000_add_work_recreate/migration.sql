-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "originWorkId" TEXT;
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "lightChecklist" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "portableRelations" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_originWorkId_idx" ON "work"("originWorkId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'work_originWorkId_fkey'
    ) THEN
        ALTER TABLE "work" ADD CONSTRAINT "work_originWorkId_fkey" FOREIGN KEY ("originWorkId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;
