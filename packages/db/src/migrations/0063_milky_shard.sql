ALTER TABLE "work" ADD COLUMN "reappear_date" date;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "status_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "work_draft" ADD COLUMN "reappear_date" date;--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_reappear_date_check" CHECK ("work"."reappear_date" is null or "work"."reappear_date"::text ~ '^\d{4}-\d{2}-\d{2}$');