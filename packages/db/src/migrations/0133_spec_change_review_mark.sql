CREATE TABLE "spec_change_review_mark" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"note" text,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"review_id" text NOT NULL,
	"section_id" text DEFAULT '' NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spec_change_review_mark_state_check" CHECK ("spec_change_review_mark"."state" in ('Waiting', 'Reviewed', 'Not affected')),
	CONSTRAINT "spec_change_review_mark_note_check" CHECK ("spec_change_review_mark"."note" is null or length(btrim("spec_change_review_mark"."note")) between 1 and 500),
	CONSTRAINT "spec_change_review_mark_revision_check" CHECK ("spec_change_review_mark"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "spec_change_review_mark" ADD CONSTRAINT "spec_change_review_mark_review_id_spec_change_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."spec_change_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spec_change_review_mark_candidate_uidx" ON "spec_change_review_mark" USING btree ("review_id","record_type","record_id","section_id");