CREATE TABLE "project_backlog_presentation" (
	"project_id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"saved" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_backlog_presentation_revision_check" CHECK ("project_backlog_presentation"."revision" >= 0),
	CONSTRAINT "project_backlog_presentation_saved_check" CHECK (jsonb_typeof("project_backlog_presentation"."saved") = 'object')
);
--> statement-breakpoint
ALTER TABLE "project_backlog_presentation" ADD CONSTRAINT "project_backlog_presentation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;