-- CreateTable
CREATE TABLE "completion_effect_preference" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'Calm',
    "palette" TEXT NOT NULL DEFAULT 'Haze',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "completion_effect_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "completion_effect_preference_accountId_key" ON "completion_effect_preference"("accountId");

-- AddForeignKey
ALTER TABLE "completion_effect_preference" ADD CONSTRAINT "completion_effect_preference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user"("id") ON UPDATE CASCADE ON DELETE CASCADE;
