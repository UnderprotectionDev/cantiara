-- AlterTable
ALTER TABLE "mutation_fixture_record"
    ADD COLUMN "fieldsText" TEXT NOT NULL DEFAULT '{}',
    ADD COLUMN "retiredIntoId" TEXT;

-- AlterTable
ALTER TABLE "record_history_entry"
    ADD COLUMN "changeKind" TEXT NOT NULL DEFAULT 'field',
    ADD COLUMN "fieldKey" TEXT NOT NULL DEFAULT 'value',
    ADD COLUMN "affectedFields" TEXT NOT NULL DEFAULT '["value"]',
    ADD COLUMN "mergeRetiredId" TEXT,
    ADD COLUMN "mergeAttributed" TEXT;

-- CreateTable
CREATE TABLE "mutation_fixture_relation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_fixture_relation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mutation_fixture_relation_fromId_idx" ON "mutation_fixture_relation"("fromId");

-- AddForeignKey
ALTER TABLE "mutation_fixture_relation" ADD CONSTRAINT "mutation_fixture_relation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "mutation_fixture_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutation_fixture_relation" ADD CONSTRAINT "mutation_fixture_relation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "mutation_fixture_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
