-- CreateTable
CREATE TABLE "work_template" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "descriptionSkeleton" TEXT,
    "selectedFieldDefaults" JSONB NOT NULL DEFAULT '[]',
    "lightChecklist" JSONB NOT NULL DEFAULT '[]',
    "plannedStartOffsetDays" INTEGER,
    "targetDateOffsetDays" INTEGER,
    "trashedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_template_projectId_idx" ON "work_template"("projectId");

-- CreateIndex
CREATE INDEX "work_template_projectId_trashedAt_idx" ON "work_template"("projectId", "trashedAt");

-- AddForeignKey
ALTER TABLE "work_template" ADD CONSTRAINT "work_template_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
