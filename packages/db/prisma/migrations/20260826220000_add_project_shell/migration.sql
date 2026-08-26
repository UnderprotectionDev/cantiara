-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "lifecycleStatus" TEXT NOT NULL,
    "starterConfiguration" TEXT NOT NULL,
    "purpose" TEXT,
    "problem" TEXT,
    "scope" TEXT,
    "targetDate" TEXT,
    "logoFileName" TEXT,
    "hasWork" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_short_code_reservation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_short_code_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_workspaceId_idx" ON "project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_short_code_reservation_workspaceId_shortCode_key" ON "workspace_short_code_reservation"("workspaceId", "shortCode");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_short_code_reservation" ADD CONSTRAINT "workspace_short_code_reservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON UPDATE CASCADE ON DELETE CASCADE;
