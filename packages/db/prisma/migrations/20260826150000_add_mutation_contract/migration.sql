-- CreateTable
CREATE TABLE "mutation_fixture_record" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mutation_fixture_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_receipt" (
    "id" TEXT NOT NULL,
    "commandKey" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "committedRevision" INTEGER NOT NULL,
    "resultValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_history_entry" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "previousValue" TEXT NOT NULL,
    "nextValue" TEXT NOT NULL,
    "revisionAfter" INTEGER NOT NULL,

    CONSTRAINT "record_history_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mutation_receipt_commandKey_key" ON "mutation_receipt"("commandKey");

-- CreateIndex
CREATE INDEX "mutation_receipt_targetId_idx" ON "mutation_receipt"("targetId");

-- CreateIndex
CREATE INDEX "record_history_entry_targetId_occurredAt_idx" ON "record_history_entry"("targetId", "occurredAt");

-- AddForeignKey
ALTER TABLE "record_history_entry" ADD CONSTRAINT "record_history_entry_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "mutation_fixture_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
