CREATE TABLE "project_session_test_review" (
	"review_state" text NOT NULL,
	"session_test_id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_session_test_review_state_check" CHECK ("review_state" in ('Unreviewed', 'Reviewed', 'Follow-up needed', 'Closed'))
);
--> statement-breakpoint
CREATE TABLE "project_test_review_event" (
	"action" text NOT NULL,
	"actor_account_id" text NOT NULL,
	"batch_id" text,
	"from_state" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"reason" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"remaining" jsonb,
	"session_id" text NOT NULL,
	"session_test_id" text,
	"to_state" text NOT NULL,
	CONSTRAINT "project_test_review_event_action_check" CHECK ("project_test_review_event"."action" in ('Review state set', 'Bulk review')),
	CONSTRAINT "project_test_review_event_state_check" CHECK ("from_state" in ('Unreviewed', 'Reviewed', 'Follow-up needed', 'Closed') and "to_state" in ('Unreviewed', 'Reviewed', 'Follow-up needed', 'Closed'))
);
--> statement-breakpoint
ALTER TABLE "project_session_test_review" ADD CONSTRAINT "project_session_test_review_session_test_id_project_session_test_id_fk" FOREIGN KEY ("session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_review_event" ADD CONSTRAINT "project_test_review_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_review_event" ADD CONSTRAINT "project_test_review_event_session_id_project_test_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_test_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_review_event_session_idx" ON "project_test_review_event" USING btree ("session_id","recorded_at");--> statement-breakpoint
CREATE INDEX "project_test_review_event_project_idx" ON "project_test_review_event" USING btree ("project_id","recorded_at");