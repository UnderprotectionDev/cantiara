ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "focusOrder" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "project_wall_card" ADD COLUMN IF NOT EXISTS "authority" TEXT;
ALTER TABLE "project_wall_card" ADD COLUMN IF NOT EXISTS "pinVersionId" TEXT;
