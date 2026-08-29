-- CreateTable
CREATE TABLE "project_priority_map_presentation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "horizontalCriterionId" TEXT NOT NULL,
    "verticalCriterionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_priority_map_presentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_priority_map_presentation_projectId_key" ON "project_priority_map_presentation"("projectId");

-- AddForeignKey
ALTER TABLE "project_priority_map_presentation" ADD CONSTRAINT "project_priority_map_presentation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
