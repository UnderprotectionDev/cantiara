-- AlterTable
ALTER TABLE "work" ADD COLUMN "targetDate" TEXT;
ALTER TABLE "work" ADD COLUMN "reappearDate" TEXT;

-- CreateTable
CREATE TABLE "daily_focus_candidate_rejection" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "calendarDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_focus_candidate_rejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_focus_candidate_rejection_accountId_workId_calendarDay_key" ON "daily_focus_candidate_rejection"("accountId", "workId", "calendarDay");

CREATE INDEX "daily_focus_candidate_rejection_accountId_calendarDay_idx" ON "daily_focus_candidate_rejection"("accountId", "calendarDay");

-- AddForeignKey
ALTER TABLE "daily_focus_candidate_rejection" ADD CONSTRAINT "daily_focus_candidate_rejection_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
