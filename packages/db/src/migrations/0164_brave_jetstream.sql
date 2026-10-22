CREATE TABLE "work_automation_application" (
	"applied_at" timestamp NOT NULL,
	"changes" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"previous_values" jsonb NOT NULL,
	"project_id" text NOT NULL,
	"undo_until" timestamp NOT NULL,
	"undone_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "work_automation_rule" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"definition" jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"trashed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "work_automation_rule_name_check" CHECK (length(btrim("work_automation_rule"."name")) > 0),
	CONSTRAINT "work_automation_rule_revision_check" CHECK ("work_automation_rule"."revision" >= 1),
	CONSTRAINT "work_automation_rule_version_check" CHECK ("work_automation_rule"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "work_automation_rule_version" (
	"definition" jsonb NOT NULL,
	"name" text NOT NULL,
	"rule_id" text NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "work_automation_rule_version_rule_id_version_pk" PRIMARY KEY("rule_id","version")
);
--> statement-breakpoint
CREATE TABLE "work_automation_signal" (
	"failed_step" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"project_id" text NOT NULL,
	"reason" text NOT NULL,
	"rule_id" text NOT NULL,
	"rule_name" text NOT NULL,
	"rule_version" integer NOT NULL,
	"trigger" jsonb NOT NULL,
	"trigger_event_id" text NOT NULL,
	CONSTRAINT "work_automation_signal_kind_check" CHECK ("work_automation_signal"."kind" in ('automation-failed', 'automation-conflict'))
);
--> statement-breakpoint
ALTER TABLE "work_automation_application" ADD CONSTRAINT "work_automation_application_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_automation_rule" ADD CONSTRAINT "work_automation_rule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_automation_rule_version" ADD CONSTRAINT "work_automation_rule_version_rule_id_work_automation_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."work_automation_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_automation_signal" ADD CONSTRAINT "work_automation_signal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_automation_application_key_uidx" ON "work_automation_application" USING btree ("project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "work_automation_rule_project_idx" ON "work_automation_rule" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_automation_rule_project_name_uidx" ON "work_automation_rule" USING btree ("project_id","name_key");--> statement-breakpoint
CREATE INDEX "work_automation_signal_project_idx" ON "work_automation_signal" USING btree ("project_id","occurred_at");