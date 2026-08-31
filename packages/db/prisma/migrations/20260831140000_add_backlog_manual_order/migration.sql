-- CreateTable
CREATE TABLE "project_backlog_manual_order_item" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_backlog_manual_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_backlog_presentation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sort" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_backlog_presentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_backlog_manual_order_item_projectId_workId_key" ON "project_backlog_manual_order_item"("projectId", "workId");

-- CreateIndex
CREATE INDEX "project_backlog_manual_order_item_projectId_idx" ON "project_backlog_manual_order_item"("projectId");

-- CreateIndex
CREATE INDEX "project_backlog_manual_order_item_workId_idx" ON "project_backlog_manual_order_item"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "project_backlog_presentation_projectId_key" ON "project_backlog_presentation"("projectId");

-- AddForeignKey
ALTER TABLE "project_backlog_manual_order_item" ADD CONSTRAINT "project_backlog_manual_order_item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_backlog_manual_order_item" ADD CONSTRAINT "project_backlog_manual_order_item_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_backlog_presentation" ADD CONSTRAINT "project_backlog_presentation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
