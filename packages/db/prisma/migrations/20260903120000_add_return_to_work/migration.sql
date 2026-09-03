-- AlterTable
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "nextConcreteStep" TEXT;
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "nextConcreteStepUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "nextConcreteStep" TEXT;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "nextConcreteStepUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "next_concrete_step_change" (
    "id" TEXT NOT NULL,
    "workId" TEXT,
    "projectId" TEXT,
    "previousValue" TEXT,
    "nextValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "next_concrete_step_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "return_to_work_visible_open" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_to_work_visible_open_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "next_concrete_step_change_workId_createdAt_idx" ON "next_concrete_step_change"("workId", "createdAt");

CREATE INDEX IF NOT EXISTS "next_concrete_step_change_projectId_createdAt_idx" ON "next_concrete_step_change"("projectId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "return_to_work_visible_open_accountId_sourceKind_sourceId_key" ON "return_to_work_visible_open"("accountId", "sourceKind", "sourceId");

CREATE INDEX IF NOT EXISTS "return_to_work_visible_open_accountId_sourceKind_idx" ON "return_to_work_visible_open"("accountId", "sourceKind");

-- AddForeignKey
ALTER TABLE "next_concrete_step_change" ADD CONSTRAINT "next_concrete_step_change_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "next_concrete_step_change" ADD CONSTRAINT "next_concrete_step_change_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
