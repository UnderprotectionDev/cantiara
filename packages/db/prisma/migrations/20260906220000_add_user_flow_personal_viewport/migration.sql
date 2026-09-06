-- CreateTable
CREATE TABLE IF NOT EXISTS "user_flow_personal_viewport" (
    "id" TEXT NOT NULL,
    "userFlowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "zoom" DOUBLE PRECISION NOT NULL,
    "collapsedGroupIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_flow_personal_viewport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_flow_personal_viewport_userFlowId_userId_key" ON "user_flow_personal_viewport"("userFlowId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_flow_personal_viewport_userId_idx" ON "user_flow_personal_viewport"("userId");

-- AddForeignKey (idempotent: parallel Cloud Agent deploys can create the
-- tables, then a second apply hits "constraint already exists" / P3009 and
-- the `dev` terminal never binds 3000/3001/4000).
DO $$ BEGIN
    ALTER TABLE "user_flow_personal_viewport" ADD CONSTRAINT "user_flow_personal_viewport_userFlowId_fkey" FOREIGN KEY ("userFlowId") REFERENCES "user_flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "user_flow_personal_viewport" ADD CONSTRAINT "user_flow_personal_viewport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
