-- CreateTable
CREATE TABLE "project_custom_field_definition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "boundRecordTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_custom_field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_custom_field_definition_projectId_idx" ON "project_custom_field_definition"("projectId");

-- AddForeignKey
ALTER TABLE "project_custom_field_definition" ADD CONSTRAINT "project_custom_field_definition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
