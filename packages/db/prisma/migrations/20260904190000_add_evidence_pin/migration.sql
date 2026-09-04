-- CreateTable
CREATE TABLE IF NOT EXISTS "evidence_pin" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "sourceVersionNumber" INTEGER NOT NULL,
    "rangeStart" INTEGER NOT NULL,
    "rangeEnd" INTEGER NOT NULL,
    "rangeText" TEXT NOT NULL,
    "surroundingText" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "originOwnerKind" TEXT,
    "originOwnerId" TEXT,
    "originComponentId" TEXT,
    "originSourceVersion" TEXT,
    "originComponentMissing" BOOLEAN NOT NULL DEFAULT false,
    "contentRedacted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "evidence_pin_relationId_key" ON "evidence_pin"("relationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evidence_pin_sourceKind_sourceId_idx" ON "evidence_pin"("sourceKind", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evidence_pin_sourceVersionId_idx" ON "evidence_pin"("sourceVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evidence_pin_targetKind_targetId_idx" ON "evidence_pin"("targetKind", "targetId");
