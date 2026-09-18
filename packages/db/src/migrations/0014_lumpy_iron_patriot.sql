ALTER TABLE "capture_inbox_item" ADD COLUMN "attachment" jsonb;--> statement-breakpoint
ALTER TABLE "capture_inbox_item" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "capture_inbox_item" ADD COLUMN "origin" jsonb;