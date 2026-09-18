-- Repair databases whose migration history recorded the Project table without revision.
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "revision" integer;
--> statement-breakpoint
UPDATE "project" SET "revision" = 0 WHERE "revision" IS NULL;
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "revision" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "revision" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_revision_check'
      AND conrelid = 'public.project'::regclass
  ) THEN
    ALTER TABLE "project"
      ADD CONSTRAINT "project_revision_check" CHECK ("revision" >= 0);
  END IF;
END $$;
