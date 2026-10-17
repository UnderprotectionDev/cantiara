CREATE TABLE "workspace_contact_merge" (
	"adopted_display_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"merged_at" timestamp DEFAULT now() NOT NULL,
	"retired_archived_at" timestamp,
	"retired_contact_id" text NOT NULL,
	"retired_created_at" timestamp NOT NULL,
	"retired_display_name" text,
	"retired_revision" integer NOT NULL,
	"surviving_contact_id" text NOT NULL,
	"undone_at" timestamp,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_contact_merge_link" (
	"attributed" boolean NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"merge_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "workspace_contact_merge_link_kind_check" CHECK ("workspace_contact_merge_link"."kind" in ('email', 'feedback', 'persona', 'affiliation', 'redirect'))
);
--> statement-breakpoint
ALTER TABLE "workspace_contact_audit_event" DROP CONSTRAINT "workspace_contact_audit_event_type_check";--> statement-breakpoint
ALTER TABLE "workspace_contact_merge" ADD CONSTRAINT "workspace_contact_merge_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_merge_link" ADD CONSTRAINT "workspace_contact_merge_link_merge_id_workspace_contact_merge_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."workspace_contact_merge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_contact_merge_retired_idx" ON "workspace_contact_merge" USING btree ("workspace_id","retired_contact_id");--> statement-breakpoint
CREATE INDEX "workspace_contact_merge_link_merge_idx" ON "workspace_contact_merge_link" USING btree ("merge_id");--> statement-breakpoint
ALTER TABLE "workspace_contact_audit_event" ADD CONSTRAINT "workspace_contact_audit_event_type_check" CHECK ("workspace_contact_audit_event"."event_type" in ('contact.merged', 'contact.merge_undone'));