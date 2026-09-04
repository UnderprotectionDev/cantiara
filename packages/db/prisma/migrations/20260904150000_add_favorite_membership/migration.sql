-- CreateTable
CREATE TABLE IF NOT EXISTS "favorite_membership" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorite_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "favorite_membership_accountId_sourceType_sourceId_key" ON "favorite_membership"("accountId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "favorite_membership_accountId_idx" ON "favorite_membership"("accountId");

-- AddForeignKey
ALTER TABLE "favorite_membership" ADD CONSTRAINT "favorite_membership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
