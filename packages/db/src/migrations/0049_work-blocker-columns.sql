ALTER TABLE "work_relation" ADD COLUMN "blocking_status" text;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "blocking_resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "blocking_resolution_note" text;