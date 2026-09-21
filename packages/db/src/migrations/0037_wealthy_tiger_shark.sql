ALTER TABLE "work" ADD COLUMN "effort" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_effort_check" CHECK ("work"."effort" is null or length(btrim("work"."effort")) between 1 and 255);--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_target_date_check" CHECK ("work"."target_date" is null or "work"."target_date"::text ~ '^\d{4}-\d{2}-\d{2}$');