-- AlterTable
ALTER TABLE "evidence_pin" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'Unspecified';
ALTER TABLE "evidence_pin" ADD COLUMN IF NOT EXISTS "founderInterpretation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "evidence_pin" ADD COLUMN IF NOT EXISTS "roleActorId" TEXT;
ALTER TABLE "evidence_pin" ADD COLUMN IF NOT EXISTS "roleSetAt" TIMESTAMP(3);
ALTER TABLE "evidence_pin" ADD COLUMN IF NOT EXISTS "interpretationActorId" TEXT;
ALTER TABLE "evidence_pin" ADD COLUMN IF NOT EXISTS "interpretationSetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "evidence_relation_history" (
    "id" TEXT NOT NULL,
    "pinId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previousValue" TEXT NOT NULL,
    "nextValue" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_relation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evidence_relation_history_pinId_occurredAt_idx" ON "evidence_relation_history"("pinId", "occurredAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'evidence_relation_history_pinId_fkey'
    ) THEN
        ALTER TABLE "evidence_relation_history" ADD CONSTRAINT "evidence_relation_history_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "evidence_pin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
