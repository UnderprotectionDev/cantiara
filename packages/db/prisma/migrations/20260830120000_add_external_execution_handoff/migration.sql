-- CreateTable
CREATE TABLE "external_execution_handoff" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "executorVisibleName" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "selectedVersionManifest" JSONB NOT NULL,
    "permittedGithubContext" JSONB NOT NULL,
    "goingPackageMarkdown" TEXT NOT NULL,
    "goingPackageProducedAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_execution_handoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_execution_handoff_workId_createdAt_idx" ON "external_execution_handoff"("workId", "createdAt");

-- AddForeignKey
ALTER TABLE "external_execution_handoff" ADD CONSTRAINT "external_execution_handoff_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
