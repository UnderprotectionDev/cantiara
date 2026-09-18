ALTER TABLE "work" ADD COLUMN "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "recreated_from_work_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "recreated_from_work_key" text;