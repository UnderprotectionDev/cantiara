CREATE TABLE "project_github_attention_signal" (
	"closed_at" timestamp,
	"dismissed_at" timestamp,
	"occurred_at" timestamp NOT NULL,
	"owner_account_id" text NOT NULL,
	"presentation" text DEFAULT 'Action Required' NOT NULL,
	"project_id" text NOT NULL,
	"record_id" text NOT NULL,
	"signal_id" text PRIMARY KEY NOT NULL,
	"signal_type" text NOT NULL,
	"work_id" text,
	CONSTRAINT "project_github_attention_signal_type_check" CHECK ("project_github_attention_signal"."signal_type" in ('unlinked-open-pr', 'work-pr-status-conflict')),
	CONSTRAINT "project_github_attention_signal_presentation_check" CHECK ("project_github_attention_signal"."presentation" = 'Action Required')
);
--> statement-breakpoint
CREATE TABLE "project_github_work_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_account_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"matched_key" text,
	"origin" text NOT NULL,
	"project_id" text NOT NULL,
	"record_id" text,
	"removed_at" timestamp,
	"repository_link_id" text NOT NULL,
	"role" text NOT NULL,
	"target_key" text NOT NULL,
	"value" text,
	"work_id" text NOT NULL,
	CONSTRAINT "project_github_work_link_role_check" CHECK ("project_github_work_link"."role" in ('Required for completion', 'Contextual')),
	CONSTRAINT "project_github_work_link_kind_check" CHECK ("project_github_work_link"."kind" in ('Issue', 'Pull request', 'Commit', 'Branch')),
	CONSTRAINT "project_github_work_link_origin_check" CHECK ("project_github_work_link"."origin" in ('Manual', 'Key match', 'Create work and link')),
	CONSTRAINT "project_github_work_link_required_pr_check" CHECK ("project_github_work_link"."role" = 'Contextual' or "project_github_work_link"."kind" = 'Pull request'),
	CONSTRAINT "project_github_work_link_target_check" CHECK (("project_github_work_link"."kind" in ('Issue', 'Pull request') and "project_github_work_link"."record_id" is not null and "project_github_work_link"."value" is null) or ("project_github_work_link"."kind" in ('Commit', 'Branch') and "project_github_work_link"."record_id" is null and "project_github_work_link"."value" is not null))
);
--> statement-breakpoint
CREATE TABLE "project_github_work_link_suggestion" (
	"closing_intent" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"project_id" text NOT NULL,
	"reason" text NOT NULL,
	"record_id" text NOT NULL,
	"work_id" text,
	CONSTRAINT "project_github_work_link_suggestion_reason_check" CHECK ("project_github_work_link_suggestion"."reason" in ('Multiple Work keys', 'No Work with this key', 'Key belongs to another Project'))
);
--> statement-breakpoint
ALTER TABLE "project_github_attention_signal" ADD CONSTRAINT "project_github_attention_signal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_attention_signal" ADD CONSTRAINT "project_github_attention_signal_record_id_project_github_external_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."project_github_external_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_work_link" ADD CONSTRAINT "project_github_work_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_work_link" ADD CONSTRAINT "project_github_work_link_record_id_project_github_external_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."project_github_external_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_work_link" ADD CONSTRAINT "project_github_work_link_repository_link_id_project_github_repository_link_id_fk" FOREIGN KEY ("repository_link_id") REFERENCES "public"."project_github_repository_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_work_link_suggestion" ADD CONSTRAINT "project_github_work_link_suggestion_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_work_link_suggestion" ADD CONSTRAINT "project_github_work_link_suggestion_record_id_project_github_external_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."project_github_external_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_github_attention_signal_project_idx" ON "project_github_attention_signal" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_work_link_work_target_idx" ON "project_github_work_link" USING btree ("work_id","target_key");--> statement-breakpoint
CREATE INDEX "project_github_work_link_project_idx" ON "project_github_work_link" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_github_work_link_record_idx" ON "project_github_work_link" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "project_github_work_link_suggestion_record_idx" ON "project_github_work_link_suggestion" USING btree ("record_id");