CREATE TABLE "project_update" (
	"created_at" timestamp NOT NULL,
	"id" text NOT NULL,
	"mark" text NOT NULL,
	"narrative" text NOT NULL,
	"project_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "project_update_pk" PRIMARY KEY("project_id","id"),
	CONSTRAINT "project_update_mark_check" CHECK ("project_update"."mark" in ('On Track', 'At Risk', 'Off Track')),
	CONSTRAINT "project_update_narrative_check" CHECK (length(btrim("project_update"."narrative")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "project_update_link" (
	"project_id" text NOT NULL,
	"project_update_id" text NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	CONSTRAINT "project_update_link_pk" PRIMARY KEY("project_update_id","target_type","target_id"),
	CONSTRAINT "project_update_link_target_type_check" CHECK ("project_update_link"."target_type" in ('Risk', 'Decision', 'Milestone', 'Work'))
);
--> statement-breakpoint
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
ALTER TABLE "project_update" ADD CONSTRAINT "project_update_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update_link" ADD CONSTRAINT "project_update_link_update_fk" FOREIGN KEY ("project_update_id","project_id") REFERENCES "public"."project_update"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update_reminder" ADD CONSTRAINT "project_update_reminder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_update_project_created_at_idx" ON "project_update" USING btree ("project_id","created_at");