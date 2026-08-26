-- AlterTable
ALTER TABLE "mutation_receipt" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'commit';

-- CreateTable
CREATE TABLE "mutation_staging_operation" (
    "id" TEXT NOT NULL,
    "commandKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "targetScope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mutation_staging_operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_fixture_counter" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mutation_fixture_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_fixture_index_entry" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_fixture_index_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mutation_staging_operation_commandKey_key" ON "mutation_staging_operation"("commandKey");

-- CreateIndex
CREATE INDEX "mutation_staging_operation_status_expiresAt_idx" ON "mutation_staging_operation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mutation_fixture_counter_targetId_key" ON "mutation_fixture_counter"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "mutation_fixture_index_entry_targetId_token_key" ON "mutation_fixture_index_entry"("targetId", "token");
