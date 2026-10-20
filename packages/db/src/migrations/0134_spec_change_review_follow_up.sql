CREATE TABLE "spec_change_review_follow_up" (
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"review_id" text NOT NULL,
	"section_id" text DEFAULT '' NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "spec_change_review_follow_up_revision_check" CHECK ("spec_change_review_follow_up"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "spec_change_review_follow_up" ADD CONSTRAINT "spec_change_review_follow_up_review_id_spec_change_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."spec_change_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spec_change_review_follow_up_candidate_uidx" ON "spec_change_review_follow_up" USING btree ("review_id","record_type","record_id","section_id");--> statement-breakpoint
CREATE INDEX "spec_change_review_follow_up_work_idx" ON "spec_change_review_follow_up" USING btree ("work_id");