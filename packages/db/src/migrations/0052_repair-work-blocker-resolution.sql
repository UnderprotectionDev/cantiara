-- Repair databases whose migration watermark advanced while the blocker
-- resolution columns and lifecycle constraint were still missing.
ALTER TABLE "work_relation"
	ADD COLUMN IF NOT EXISTS "blocking_status" text;
--> statement-breakpoint
ALTER TABLE "work_relation"
	ADD COLUMN IF NOT EXISTS "blocking_resolved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "work_relation"
	ADD COLUMN IF NOT EXISTS "blocking_resolution_note" text;
--> statement-breakpoint
UPDATE "work_relation"
SET "blocking_status" = 'Active',
	"blocking_resolved_at" = NULL,
	"blocking_resolution_note" = NULL
WHERE "kind" = 'Blocks' AND "blocking_status" IS NULL;
--> statement-breakpoint
ALTER TABLE "work_relation"
	DROP CONSTRAINT IF EXISTS "work_relation_blocking_status_check";
--> statement-breakpoint
ALTER TABLE "work_relation"
	ADD CONSTRAINT "work_relation_blocking_status_check"
	CHECK (
		("kind" <> 'Blocks'
			AND "blocking_status" IS NULL
			AND "blocking_resolved_at" IS NULL
			AND "blocking_resolution_note" IS NULL)
		OR ("kind" = 'Blocks'
			AND "blocking_status" = 'Active'
			AND "blocking_resolved_at" IS NULL
			AND "blocking_resolution_note" IS NULL)
		OR ("kind" = 'Blocks' AND "blocking_status" = 'Resolved')
	);
