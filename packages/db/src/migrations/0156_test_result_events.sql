CREATE TABLE "project_test_result_event" (
	"actor_account_id" text NOT NULL,
	"corrected_result" text,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"previous_event_id" text,
	"project_id" text NOT NULL,
	"reason" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"redacted_event_id" text,
	"redacted_field" text,
	"session_id" text NOT NULL,
	"session_test_id" text,
	CONSTRAINT "project_test_result_event_kind_check" CHECK ("project_test_result_event"."kind" in ('Correction', 'Withdrawal', 'Redaction')),
	CONSTRAINT "project_test_result_event_redacted_field_check" CHECK ("project_test_result_event"."redacted_field" is null or "project_test_result_event"."redacted_field" in ('Reported result', 'Session summary', 'Event content'))
);
--> statement-breakpoint
ALTER TABLE "project_test_result_event" ADD CONSTRAINT "project_test_result_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_result_event" ADD CONSTRAINT "project_test_result_event_session_id_project_test_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_test_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_result_event_session_idx" ON "project_test_result_event" USING btree ("session_id","recorded_at");--> statement-breakpoint
CREATE INDEX "project_test_result_event_project_idx" ON "project_test_result_event" USING btree ("project_id","recorded_at");