CREATE TABLE "record_usage_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source_record_id" text NOT NULL,
	"source_record_type" text DEFAULT 'Work' NOT NULL,
	"surface_context" text,
	"surface_record_id" text NOT NULL,
	"surface_record_type" text NOT NULL,
	CONSTRAINT "record_usage_link_kind_check" CHECK ("record_usage_link"."kind" in ('Inline reference', 'Section reference', 'Live block', 'Pinned bind', 'Screen reference')),
	CONSTRAINT "record_usage_link_source_record_type_check" CHECK (length(btrim("record_usage_link"."source_record_type")) > 0),
	CONSTRAINT "record_usage_link_surface_record_type_check" CHECK (length(btrim("record_usage_link"."surface_record_type")) > 0)
);
--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "origin_component_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "origin_owner_record_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "origin_source_version" text;--> statement-breakpoint
ALTER TABLE "record_usage_link" ADD CONSTRAINT "record_usage_link_source_record_id_work_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_usage_link_source_idx" ON "record_usage_link" USING btree ("source_record_type","source_record_id");--> statement-breakpoint
CREATE INDEX "record_usage_link_surface_idx" ON "record_usage_link" USING btree ("surface_record_type","surface_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_relation_unique_per_source_uidx" ON "work_relation" USING btree ("kind","source_record_type","source_work_id") WHERE "work_relation"."deleted_at" is null and "work_relation"."kind" in ('Primary spec', 'Belongs to Company', 'Participant');--> statement-breakpoint
CREATE UNIQUE INDEX "work_relation_unique_per_target_uidx" ON "work_relation" USING btree ("kind","target_record_type","target_record_id") WHERE "work_relation"."deleted_at" is null and "work_relation"."kind" = 'Includes';