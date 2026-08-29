-- CreateTable
CREATE TABLE "project_work_context_layout" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_work_context_layout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_context_layout_revision" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_context_layout_revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_work_context_layout_projectId_workType_key" ON "project_work_context_layout"("projectId", "workType");

-- CreateIndex
CREATE INDEX "project_work_context_layout_projectId_idx" ON "project_work_context_layout"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_context_layout_revision_layoutId_revision_key" ON "project_work_context_layout_revision"("layoutId", "revision");

-- CreateIndex
CREATE INDEX "project_work_context_layout_revision_layoutId_idx" ON "project_work_context_layout_revision"("layoutId");

-- AddForeignKey
ALTER TABLE "project_work_context_layout" ADD CONSTRAINT "project_work_context_layout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_context_layout_revision" ADD CONSTRAINT "project_work_context_layout_revision_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "project_work_context_layout"("id") ON UPDATE CASCADE ON DELETE CASCADE;
