ALTER TABLE "trash_entry" DROP CONSTRAINT "trash_entry_record_kind_check";--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "frozen_revision" integer;--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "trash_entry" ADD CONSTRAINT "trash_entry_record_kind_check" CHECK ("trash_entry"."record_kind" in ('Work', 'Document', 'Decision', 'Risk', 'Screen', 'External Surface'));