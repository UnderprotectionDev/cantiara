-- CreateTable
CREATE TABLE "record_action" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "targetKind" TEXT NOT NULL,
    "trashedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_action_projectId_idx" ON "record_action"("projectId");

-- CreateIndex
CREATE INDEX "record_action_projectId_trashedAt_idx" ON "record_action"("projectId", "trashedAt");

-- AddForeignKey
ALTER TABLE "record_action" ADD CONSTRAINT "record_action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
