-- Repair databases whose migration metadata includes 0037 while the Work
-- planning fields were not applied to the physical schema.
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "effort" text;
--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "target_date" date;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'work_effort_check'
			AND conrelid = 'public.work'::regclass
	) THEN
		ALTER TABLE "work"
			ADD CONSTRAINT "work_effort_check"
			CHECK ("work"."effort" is null or length(btrim("work"."effort")) between 1 and 255);
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'work_target_date_check'
			AND conrelid = 'public.work'::regclass
	) THEN
		ALTER TABLE "work"
			ADD CONSTRAINT "work_target_date_check"
			CHECK ("work"."target_date" is null or "work"."target_date"::text ~ '^\d{4}-\d{2}-\d{2}$');
	END IF;
END $$;
