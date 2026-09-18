CREATE TABLE "work_relation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source_work_id" text NOT NULL,
	"target_label" text NOT NULL,
	"target_project_id" text NOT NULL,
	"target_record_id" text NOT NULL,
	CONSTRAINT "work_relation_kind_check" CHECK ("work_relation"."kind" in ('Related', 'Evidence', 'Contributes to Goal', 'Contributes to Milestone', 'Implements', 'GitHub Completion', 'Automation', 'Planning Membership', 'Publish', 'Parentage', 'Merge State', 'History', 'Closure Result', 'Status', 'Date', 'Origin')),
	CONSTRAINT "work_relation_target_label_check" CHECK (length(btrim("work_relation"."target_label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_source_work_id_work_id_fk" FOREIGN KEY ("source_work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_relation_source_idx" ON "work_relation" USING btree ("source_work_id");