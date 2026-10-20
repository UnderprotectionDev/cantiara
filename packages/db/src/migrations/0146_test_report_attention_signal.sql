CREATE TABLE "project_test_report_attention_signal" (
	"closed_at" timestamp,
	"handoff_id" text,
	"occurred_at" timestamp NOT NULL,
	"owner_account_id" text NOT NULL,
	"presentation" text NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text NOT NULL,
	"signal_id" text PRIMARY KEY NOT NULL,
	"signal_type" text NOT NULL,
	CONSTRAINT "project_test_report_attention_signal_type_check" CHECK ("project_test_report_attention_signal"."signal_type" in ('unreviewed-test-report', 'handoff-result-after-cancel')),
	CONSTRAINT "project_test_report_attention_signal_id_check" CHECK ("project_test_report_attention_signal"."signal_id" = "project_test_report_attention_signal"."signal_type" || ':' || "project_test_report_attention_signal"."session_id"),
	CONSTRAINT "project_test_report_attention_signal_presentation_check" CHECK (("project_test_report_attention_signal"."signal_type" = 'unreviewed-test-report' and "project_test_report_attention_signal"."presentation" = 'Action Required') or ("project_test_report_attention_signal"."signal_type" = 'handoff-result-after-cancel' and "project_test_report_attention_signal"."presentation" = 'Information Feed'))
);
--> statement-breakpoint
ALTER TABLE "project_test_report_attention_signal" ADD CONSTRAINT "project_test_report_attention_signal_owner_account_id_user_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_report_attention_signal" ADD CONSTRAINT "project_test_report_attention_signal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_report_attention_signal" ADD CONSTRAINT "project_test_report_attention_signal_session_id_project_test_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_test_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_report_attention_signal_project_idx" ON "project_test_report_attention_signal" USING btree ("project_id");