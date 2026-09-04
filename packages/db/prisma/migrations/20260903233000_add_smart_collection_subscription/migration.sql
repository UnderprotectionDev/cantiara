-- AlterTable
ALTER TABLE "smart_collection" ADD COLUMN IF NOT EXISTS "subscribeOnEntry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "smart_collection" ADD COLUMN IF NOT EXISTS "subscribeOnExit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "smart_collection_membership_period" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordKind" TEXT NOT NULL,
    "open" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_collection_membership_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "smart_collection_attention_signal" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordKind" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_collection_attention_signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_collection_membership_period_collectionId_idx" ON "smart_collection_membership_period"("collectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_collection_membership_period_collectionId_recordId_idx" ON "smart_collection_membership_period"("collectionId", "recordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_collection_attention_signal_collectionId_idx" ON "smart_collection_attention_signal"("collectionId");

-- AddForeignKey
ALTER TABLE "smart_collection_membership_period" ADD CONSTRAINT "smart_collection_membership_period_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "smart_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_collection_attention_signal" ADD CONSTRAINT "smart_collection_attention_signal_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "smart_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
