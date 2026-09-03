-- CreateTable
CREATE TABLE IF NOT EXISTS "project_goal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "intendedOutcome" TEXT,
    "observedOutcome" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_goal_projectId_idx" ON "project_goal"("projectId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'project_goal_projectId_fkey'
    ) THEN
        ALTER TABLE "project_goal"
        ADD CONSTRAINT "project_goal_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
