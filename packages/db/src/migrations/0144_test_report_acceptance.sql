CREATE TABLE "project_test_session" (
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"context" jsonb,
	"ended_at" timestamp,
	"executor_name" text NOT NULL,
	"executor_type" text NOT NULL,
	"executor_version" text,
	"external_session_id" text NOT NULL,
	"handoff_id" text,
	"handoff_package_version" integer,
	"id" text PRIMARY KEY NOT NULL,
	"ingress" text NOT NULL,
	"project_id" text NOT NULL,
	"raw_report" text,
	"reported_at" timestamp NOT NULL,
	"reported_at_text" text NOT NULL,
	"reporter_id" text NOT NULL,
	"reporter_kind" text NOT NULL,
	"review_state" text DEFAULT 'Unreviewed' NOT NULL,
	"schema_version" text NOT NULL,
	"started_at" timestamp,
	"summary" text,
	CONSTRAINT "project_test_session_ingress_check" CHECK ("project_test_session"."ingress" in ('Application', 'File import', 'MCP')),
	CONSTRAINT "project_test_session_executor_type_check" CHECK ("project_test_session"."executor_type" in ('user', 'ai_agent', 'external_tool')),
	CONSTRAINT "project_test_session_reporter_kind_check" CHECK ("project_test_session"."reporter_kind" in ('user', 'integration')),
	CONSTRAINT "project_test_session_handoff_check" CHECK (("project_test_session"."handoff_id" is null) = ("project_test_session"."handoff_package_version" is null))
);
--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "external_test_id" text;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "normalized_result" text;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "raw_result" text;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "relations" jsonb;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "project_test_session" ADD CONSTRAINT "project_test_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_session_project_idx" ON "project_test_session" USING btree ("project_id","accepted_at");--> statement-breakpoint
ALTER TABLE "project_session_test" ADD CONSTRAINT "project_session_test_session_id_project_test_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_test_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_session_test_session_idx" ON "project_session_test" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_session_test_session_external_idx" ON "project_session_test" USING btree ("session_id","external_test_id");