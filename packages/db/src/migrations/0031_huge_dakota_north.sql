ALTER TABLE "work_relation" DROP CONSTRAINT IF EXISTS "work_relation_kind_check";--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_kind_check" CHECK ("work_relation"."kind" in ('Related', 'Origin', 'Evidence', 'Contributes to Goal', 'Blocks', 'Includes', 'Contributes to Milestone', 'Primary spec', 'Supersedes', 'Implements', 'Belongs to Company', 'Participant', 'Required for completion'));--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "broken_reason" text;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "source_record_type" text DEFAULT 'Work' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "target_record_type" text DEFAULT 'Work' NOT NULL;--> statement-breakpoint
CREATE INDEX "work_relation_target_idx" ON "work_relation" USING btree ("target_record_type","target_record_id");--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_revision_check" CHECK ("work_relation"."revision" >= 0);--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_broken_reason_check" CHECK ("work_relation"."broken_reason" is null or "work_relation"."broken_reason" in ('Archived', 'In Trash', 'Permanently deleted', 'Redacted for security', 'No access'));--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_source_record_type_check" CHECK (length(btrim("work_relation"."source_record_type")) > 0);--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_target_record_type_check" CHECK (length(btrim("work_relation"."target_record_type")) > 0);
