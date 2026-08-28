-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tag" (
    "tagId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_tag_pkey" PRIMARY KEY ("tagId","workId")
);

-- CreateIndex
CREATE INDEX "tag_workspaceId_idx" ON "tag"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_workspaceId_name_key" ON "tag"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "work_tag_workId_idx" ON "work_tag"("workId");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tag" ADD CONSTRAINT "work_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tag" ADD CONSTRAINT "work_tag_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
