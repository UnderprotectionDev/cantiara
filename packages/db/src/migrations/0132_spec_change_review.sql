CREATE TABLE "spec_change_review" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"next_revision" integer NOT NULL,
	"previous_revision" integer NOT NULL,
	"project_id" text NOT NULL,
	CONSTRAINT "spec_change_review_revision_check" CHECK ("spec_change_review"."previous_revision" >= 1 and "spec_change_review"."next_revision" > "spec_change_review"."previous_revision")
);
--> statement-breakpoint
ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_feature_id_work_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_change_review" ADD CONSTRAINT "spec_change_review_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spec_change_review_pair_uidx" ON "spec_change_review" USING btree ("feature_id","document_id","next_revision");--> statement-breakpoint
CREATE INDEX "spec_change_review_project_idx" ON "spec_change_review" USING btree ("project_id","created_at");