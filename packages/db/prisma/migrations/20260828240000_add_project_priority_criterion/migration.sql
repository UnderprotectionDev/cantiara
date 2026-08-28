-- CreateTable
CREATE TABLE "project_priority_criterion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rankExplanations" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "preparedKind" TEXT,
    "trashedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_priority_criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_priority_criterion_value" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "rank" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_priority_criterion_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_priority_criterion_projectId_idx" ON "project_priority_criterion"("projectId");

-- CreateIndex
CREATE INDEX "project_priority_criterion_projectId_trashedAt_idx" ON "project_priority_criterion"("projectId", "trashedAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_priority_criterion_value_criterionId_workId_key" ON "project_priority_criterion_value"("criterionId", "workId");

-- CreateIndex
CREATE INDEX "project_priority_criterion_value_workId_idx" ON "project_priority_criterion_value"("workId");

-- CreateIndex
CREATE INDEX "project_priority_criterion_value_criterionId_idx" ON "project_priority_criterion_value"("criterionId");

-- AddForeignKey
ALTER TABLE "project_priority_criterion" ADD CONSTRAINT "project_priority_criterion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_priority_criterion_value" ADD CONSTRAINT "project_priority_criterion_value_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "project_priority_criterion"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_priority_criterion_value" ADD CONSTRAINT "project_priority_criterion_value_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
