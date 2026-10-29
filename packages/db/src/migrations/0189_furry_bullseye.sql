ALTER TABLE "trash_entry" DROP CONSTRAINT "trash_entry_record_kind_check";--> statement-breakpoint
ALTER TABLE "project_test_session" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_test_session" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trash_entry" ADD CONSTRAINT "trash_entry_record_kind_check" CHECK ("trash_entry"."record_kind" in ('Work', 'Document', 'Decision', 'Risk', 'Screen', 'External Surface', 'Custom Field', 'Smart Collection', 'Automation Rule', 'Work Template', 'Document Template', 'Record Action', 'Prioritization Session', 'GitHub External Record', 'Test Session'));