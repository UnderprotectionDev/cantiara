CREATE TABLE "project_test_assessment" (
	"assessed_at" timestamp DEFAULT now() NOT NULL,
	"assessor_account_id" text NOT NULL,
	"context_id" text NOT NULL,
	"context_kind" text NOT NULL,
	"decision" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"known_limits" text,
	"project_id" text NOT NULL,
	CONSTRAINT "project_test_assessment_context_kind_check" CHECK ("project_test_assessment"."context_kind" in ('Feature', 'Handoff', 'Project Release')),
	CONSTRAINT "project_test_assessment_decision_check" CHECK ("project_test_assessment"."decision" in ('Acceptable', 'Follow-up needed', 'Undecided'))
);
--> statement-breakpoint
CREATE TABLE "project_test_assessment_source" (
	"assessment_id" text NOT NULL,
	"position" integer NOT NULL,
	"source_id" text NOT NULL,
	"source_kind" text NOT NULL,
	CONSTRAINT "project_test_assessment_source_pk" PRIMARY KEY("assessment_id","source_kind","source_id"),
	CONSTRAINT "project_test_assessment_source_kind_check" CHECK ("project_test_assessment_source"."source_kind" in ('Test Session', 'Test Gap', 'Follow-up Work'))
);
--> statement-breakpoint
ALTER TABLE "project_test_assessment" ADD CONSTRAINT "project_test_assessment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_assessment_source" ADD CONSTRAINT "project_test_assessment_source_assessment_id_project_test_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."project_test_assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_assessment_project_idx" ON "project_test_assessment" USING btree ("project_id","assessed_at");--> statement-breakpoint
CREATE INDEX "project_test_assessment_context_idx" ON "project_test_assessment" USING btree ("context_kind","context_id");