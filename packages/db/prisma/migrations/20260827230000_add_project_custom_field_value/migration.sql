-- CreateTable
CREATE TABLE "project_custom_field_value" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_custom_field_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_custom_field_value_definitionId_recordType_recordId_key" ON "project_custom_field_value"("definitionId", "recordType", "recordId");

-- CreateIndex
CREATE INDEX "project_custom_field_value_recordType_recordId_idx" ON "project_custom_field_value"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "project_custom_field_value_definitionId_idx" ON "project_custom_field_value"("definitionId");

-- AddForeignKey
ALTER TABLE "project_custom_field_value" ADD CONSTRAINT "project_custom_field_value_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "project_custom_field_definition"("id") ON UPDATE CASCADE ON DELETE CASCADE;
