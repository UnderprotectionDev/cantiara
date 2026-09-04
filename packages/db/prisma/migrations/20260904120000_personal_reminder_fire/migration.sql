-- AlterTable
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "personal_reminder_history" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceLife" TEXT,
    "reason" TEXT,
    "signalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_reminder_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "personal_reminder_signal" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "reason" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_reminder_signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "personal_reminder_history_reminderId_idx" ON "personal_reminder_history"("reminderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "personal_reminder_signal_reminderId_idx" ON "personal_reminder_signal"("reminderId");

-- AddForeignKey
ALTER TABLE "personal_reminder_history" DROP CONSTRAINT IF EXISTS "personal_reminder_history_reminderId_fkey";
ALTER TABLE "personal_reminder_history" ADD CONSTRAINT "personal_reminder_history_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "personal_reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_reminder_signal" DROP CONSTRAINT IF EXISTS "personal_reminder_signal_reminderId_fkey";
ALTER TABLE "personal_reminder_signal" ADD CONSTRAINT "personal_reminder_signal_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "personal_reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
