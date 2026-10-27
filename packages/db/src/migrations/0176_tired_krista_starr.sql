CREATE TABLE "project_update_reminder" (
	"interval_days" integer NOT NULL,
	"next_due_at" timestamp,
	"personal_reminder_id" text,
	"project_id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_update_reminder_state_check" CHECK ("project_update_reminder"."state" in ('Enabled', 'Paused', 'Disabled')),
	CONSTRAINT "project_update_reminder_interval_check" CHECK ("project_update_reminder"."interval_days" between 1 and 365),
	CONSTRAINT "project_update_reminder_question_check" CHECK (length(btrim("project_update_reminder"."question")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "personal_reminder" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "project_update_reminder" ADD CONSTRAINT "project_update_reminder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;