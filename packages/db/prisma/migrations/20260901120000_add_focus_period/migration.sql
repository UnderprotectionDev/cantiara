-- CreateTable
CREATE TABLE "focus_period" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startScopeWorkIds" JSONB NOT NULL DEFAULT '[]',
    "startScopeLocked" BOOLEAN NOT NULL DEFAULT false,
    "closeScopeWorkIds" JSONB NOT NULL DEFAULT '[]',
    "closeScopeLocked" BOOLEAN NOT NULL DEFAULT false,
    "leftoverDecisionOpened" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "focus_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_period_membership" (
    "id" TEXT NOT NULL,
    "focusPeriodId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "focus_period_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "focus_period_workspaceId_idx" ON "focus_period"("workspaceId");

-- CreateIndex
CREATE INDEX "focus_period_workspaceId_status_idx" ON "focus_period"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "focus_period_membership_workId_idx" ON "focus_period_membership"("workId");

-- CreateIndex
CREATE INDEX "focus_period_membership_focusPeriodId_idx" ON "focus_period_membership"("focusPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "focus_period_membership_focusPeriodId_workId_key" ON "focus_period_membership"("focusPeriodId", "workId");

-- AddForeignKey
ALTER TABLE "focus_period" ADD CONSTRAINT "focus_period_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_period_membership" ADD CONSTRAINT "focus_period_membership_focusPeriodId_fkey" FOREIGN KEY ("focusPeriodId") REFERENCES "focus_period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_period_membership" ADD CONSTRAINT "focus_period_membership_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
