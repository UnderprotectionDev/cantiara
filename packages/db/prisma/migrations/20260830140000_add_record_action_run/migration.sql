-- CreateTable
CREATE TABLE "record_action_run" (
    "id" TEXT NOT NULL,
    "recordActionId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "attributedJson" JSONB NOT NULL,
    "appliedJson" JSONB NOT NULL,
    "workRevisionAfter" INTEGER NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_action_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_focus_membership" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_focus_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_action_run_workId_idx" ON "record_action_run"("workId");

-- CreateIndex
CREATE INDEX "record_action_run_recordActionId_idx" ON "record_action_run"("recordActionId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_focus_membership_accountId_workId_key" ON "daily_focus_membership"("accountId", "workId");

-- CreateIndex
CREATE INDEX "daily_focus_membership_accountId_idx" ON "daily_focus_membership"("accountId");

-- AddForeignKey
ALTER TABLE "record_action_run" ADD CONSTRAINT "record_action_run_recordActionId_fkey" FOREIGN KEY ("recordActionId") REFERENCES "record_action"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "record_action_run" ADD CONSTRAINT "record_action_run_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_focus_membership" ADD CONSTRAINT "daily_focus_membership_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;
