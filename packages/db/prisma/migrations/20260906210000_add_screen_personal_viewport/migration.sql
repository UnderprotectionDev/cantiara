-- CreateTable
CREATE TABLE IF NOT EXISTS "screen_personal_viewport" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "zoom" DOUBLE PRECISION NOT NULL,
    "collapsedGroupIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screen_personal_viewport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "screen_personal_viewport_screenId_userId_key" ON "screen_personal_viewport"("screenId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "screen_personal_viewport_userId_idx" ON "screen_personal_viewport"("userId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- table, then a second apply hits "constraint already exists" / P3009).
DO $$ BEGIN
    ALTER TABLE "screen_personal_viewport" ADD CONSTRAINT "screen_personal_viewport_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "screen_personal_viewport" ADD CONSTRAINT "screen_personal_viewport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
