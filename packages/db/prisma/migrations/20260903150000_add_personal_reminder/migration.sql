-- CreateTable
CREATE TABLE "personal_reminder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdByAction" TEXT NOT NULL,
    "life" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_reminder_accountId_idx" ON "personal_reminder"("accountId");

-- CreateIndex
CREATE INDEX "personal_reminder_accountId_life_idx" ON "personal_reminder"("accountId", "life");

-- CreateIndex
CREATE INDEX "personal_reminder_accountId_sourceType_sourceId_idx" ON "personal_reminder"("accountId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "personal_reminder" ADD CONSTRAINT "personal_reminder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
