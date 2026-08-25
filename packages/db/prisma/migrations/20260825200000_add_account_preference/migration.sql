-- CreateTable
CREATE TABLE "account_preference" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL,
    "firstDayOfWeek" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_preference_accountId_key" ON "account_preference"("accountId");

-- AddForeignKey
ALTER TABLE "account_preference" ADD CONSTRAINT "account_preference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user"("id") ON UPDATE CASCADE ON DELETE CASCADE;
