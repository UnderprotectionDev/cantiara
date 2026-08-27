-- CreateTable
CREATE TABLE "usage_link" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "hostRecordId" TEXT NOT NULL,
    "embedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_host_embed" (
    "id" TEXT NOT NULL,
    "hostRecordId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_host_embed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_link_hostRecordId_embedId_key" ON "usage_link"("hostRecordId", "embedId");

-- CreateIndex
CREATE INDEX "usage_link_sourceRecordId_idx" ON "usage_link"("sourceRecordId");

-- CreateIndex
CREATE INDEX "usage_link_workspaceId_idx" ON "usage_link"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_host_embed_hostRecordId_idx" ON "usage_host_embed"("hostRecordId");
