-- CreateTable
CREATE TABLE IF NOT EXISTS "typed_relation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromKind" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toKind" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "originOwnerKind" TEXT,
    "originOwnerId" TEXT,
    "originComponentId" TEXT,
    "originSourceVersion" TEXT,
    "originComponentMissing" BOOLEAN NOT NULL DEFAULT false,
    "blockerState" TEXT,
    "establishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "typed_relation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "typed_relation_type_fromKind_fromId_toKind_toId_key" ON "typed_relation"("type", "fromKind", "fromId", "toKind", "toId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "typed_relation_fromKind_fromId_idx" ON "typed_relation"("fromKind", "fromId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "typed_relation_toKind_toId_idx" ON "typed_relation"("toKind", "toId");
