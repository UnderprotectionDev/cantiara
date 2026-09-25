CREATE TABLE "project_backlog_reappear_attention_signal" (
	"occurred_at" timestamp NOT NULL,
	"owner_account_id" text NOT NULL,
	"presentation" text DEFAULT 'Action needed' NOT NULL,
	"project_id" text NOT NULL,
	"reappear_date" date NOT NULL,
	"signal_id" text PRIMARY KEY NOT NULL,
	"signal_type" text DEFAULT 'reappear-date' NOT NULL,
	"source_path" text NOT NULL,
	"source_work_id" text NOT NULL,
	CONSTRAINT "backlog_reappear_signal_type_check" CHECK ("project_backlog_reappear_attention_signal"."signal_type" = 'reappear-date'),
	CONSTRAINT "backlog_reappear_signal_presentation_check" CHECK ("project_backlog_reappear_attention_signal"."presentation" = 'Action needed')
);
--> statement-breakpoint
ALTER TABLE "project_backlog_reappear_attention_signal" ADD CONSTRAINT "project_backlog_reappear_attention_signal_owner_account_id_user_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_backlog_reappear_attention_signal" ADD CONSTRAINT "project_backlog_reappear_attention_signal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_backlog_reappear_attention_signal" ADD CONSTRAINT "project_backlog_reappear_attention_signal_source_work_id_work_id_fk" FOREIGN KEY ("source_work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backlog_reappear_signal_work_idx" ON "project_backlog_reappear_attention_signal" USING btree ("source_work_id");