-- CreateTable
CREATE TABLE "prioritization_session" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "trashedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prioritization_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioritization_session_item" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prioritization_session_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prioritization_session_projectId_idx" ON "prioritization_session"("projectId");

-- CreateIndex
CREATE INDEX "prioritization_session_projectId_trashedAt_archivedAt_idx" ON "prioritization_session"("projectId", "trashedAt", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "prioritization_session_item_sessionId_workId_key" ON "prioritization_session_item"("sessionId", "workId");

-- CreateIndex
CREATE INDEX "prioritization_session_item_sessionId_idx" ON "prioritization_session_item"("sessionId");

-- CreateIndex
CREATE INDEX "prioritization_session_item_workId_idx" ON "prioritization_session_item"("workId");

-- AddForeignKey
ALTER TABLE "prioritization_session" ADD CONSTRAINT "prioritization_session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "prioritization_session_item" ADD CONSTRAINT "prioritization_session_item_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "prioritization_session"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "prioritization_session_item" ADD CONSTRAINT "prioritization_session_item_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
