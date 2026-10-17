CREATE TABLE "workspace_contact_audit_event" (
	"actor_account_id" text NOT NULL,
	"event_type" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"merge_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"retired_contact_id" text NOT NULL,
	"surviving_contact_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_contact_audit_event_type_check" CHECK ("workspace_contact_audit_event"."event_type" in ('contact.merged'))
);
--> statement-breakpoint
CREATE TABLE "workspace_contact_feedback" (
	"contact_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"feedback_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_contact_retired_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"merge_id" text NOT NULL,
	"retired_at" timestamp DEFAULT now() NOT NULL,
	"surviving_contact_id" text NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_contact_audit_event" ADD CONSTRAINT "workspace_contact_audit_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_feedback" ADD CONSTRAINT "workspace_contact_feedback_feedback_id_project_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."project_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_feedback" ADD CONSTRAINT "workspace_contact_feedback_contact_fk" FOREIGN KEY ("contact_id","workspace_id") REFERENCES "public"."workspace_contact"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_retired_identity" ADD CONSTRAINT "workspace_contact_retired_survivor_fk" FOREIGN KEY ("surviving_contact_id","workspace_id") REFERENCES "public"."workspace_contact"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_contact_audit_workspace_idx" ON "workspace_contact_audit_event" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_contact_feedback_contact_feedback_uidx" ON "workspace_contact_feedback" USING btree ("contact_id","feedback_id");--> statement-breakpoint
CREATE INDEX "workspace_contact_feedback_feedback_idx" ON "workspace_contact_feedback" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "workspace_contact_retired_survivor_idx" ON "workspace_contact_retired_identity" USING btree ("surviving_contact_id");