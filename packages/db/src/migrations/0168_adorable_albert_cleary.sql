CREATE TABLE "project_github_pull_request_check" (
	"check_id" text NOT NULL,
	"details_url" text,
	"head_sha" text NOT NULL,
	"name" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"outcome" text NOT NULL,
	"project_id" text NOT NULL,
	"provider" text NOT NULL,
	"record_id" text NOT NULL,
	"requirement" text NOT NULL,
	CONSTRAINT "project_github_pull_request_check_pk" PRIMARY KEY("record_id","head_sha","provider","check_id"),
	CONSTRAINT "project_github_pull_request_check_outcome_check" CHECK ("project_github_pull_request_check"."outcome" in ('Passed', 'Failed', 'Pending', 'Cancelled', 'Skipped')),
	CONSTRAINT "project_github_pull_request_check_requirement_check" CHECK ("project_github_pull_request_check"."requirement" in ('Required', 'Unknown'))
);
--> statement-breakpoint
CREATE TABLE "project_github_pull_request_head" (
	"head_sha" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"project_id" text NOT NULL,
	"record_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_github_attention_signal" DROP CONSTRAINT "project_github_attention_signal_type_check";--> statement-breakpoint
ALTER TABLE "project_github_pull_request_check" ADD CONSTRAINT "project_github_pull_request_check_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_pull_request_check" ADD CONSTRAINT "project_github_pull_request_check_record_id_project_github_external_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."project_github_external_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_pull_request_head" ADD CONSTRAINT "project_github_pull_request_head_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_pull_request_head" ADD CONSTRAINT "project_github_pull_request_head_record_id_project_github_external_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."project_github_external_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_github_pull_request_check_project_idx" ON "project_github_pull_request_check" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_github_pull_request_head_project_idx" ON "project_github_pull_request_head" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "project_github_attention_signal" ADD CONSTRAINT "project_github_attention_signal_type_check" CHECK ("project_github_attention_signal"."signal_type" in ('unlinked-open-pr', 'work-pr-status-conflict', 'failed-check'));