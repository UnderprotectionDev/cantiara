-- AlterTable
ALTER TABLE "project" ADD COLUMN "firstOpenExplanationDismissed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "project_stage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_area_setting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "pinned" BOOLEAN NOT NULL,
    "pinOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_area_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_view" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_status" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "semantic" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_stage_projectId_idx" ON "project_stage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_area_setting_projectId_name_key" ON "project_area_setting"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_view_projectId_name_key" ON "project_work_view"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_status_projectId_semantic_key" ON "project_work_status"("projectId", "semantic");

-- AddForeignKey
ALTER TABLE "project_stage" ADD CONSTRAINT "project_stage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_area_setting" ADD CONSTRAINT "project_area_setting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_view" ADD CONSTRAINT "project_work_view_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_status" ADD CONSTRAINT "project_work_status_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
