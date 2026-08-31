-- AlterTable
ALTER TABLE "daily_focus_membership" ADD COLUMN "calendarDay" TEXT NOT NULL DEFAULT '1970-01-01';

ALTER TABLE "daily_focus_membership" ALTER COLUMN "calendarDay" DROP DEFAULT;

-- DropIndex
DROP INDEX "daily_focus_membership_accountId_workId_key";

DROP INDEX "daily_focus_membership_accountId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "daily_focus_membership_accountId_workId_calendarDay_key" ON "daily_focus_membership"("accountId", "workId", "calendarDay");

CREATE INDEX "daily_focus_membership_accountId_calendarDay_idx" ON "daily_focus_membership"("accountId", "calendarDay");
