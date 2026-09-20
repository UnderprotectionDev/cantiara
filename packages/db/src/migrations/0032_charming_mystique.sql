ALTER TABLE "work" ADD COLUMN "origin_component_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "origin_owner_record_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "origin_source_version" text;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "broken_reason" text;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "source_record_type" text DEFAULT 'Work' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_relation" ADD COLUMN "target_record_type" text DEFAULT 'Work' NOT NULL;--> statement-breakpoint
CREATE INDEX "work_relation_target_idx" ON "work_relation" USING btree ("target_record_type","target_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_relation_unique_per_source_uidx" ON "work_relation" USING btree ("kind","source_record_type","source_work_id") WHERE "work_relation"."deleted_at" is null and "work_relation"."kind" in ('Primary spec', 'Belongs to Company', 'Participant');--> statement-breakpoint
CREATE UNIQUE INDEX "work_relation_unique_per_target_uidx" ON "work_relation" USING btree ("kind","target_record_type","target_record_id") WHERE "work_relation"."deleted_at" is null and "work_relation"."kind" = 'Includes';--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_revision_check" CHECK ("work_relation"."revision" >= 0);--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_broken_reason_check" CHECK ("work_relation"."broken_reason" is null or "work_relation"."broken_reason" in ('Archived', 'In Trash', 'Permanently deleted', 'Redacted for security', 'No access'));--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_source_record_type_check" CHECK (length(btrim("work_relation"."source_record_type")) > 0);--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_target_record_type_check" CHECK (length(btrim("work_relation"."target_record_type")) > 0);