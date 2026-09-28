CREATE TABLE "project_milestone" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Planned' NOT NULL,
	"target_date" date,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_milestone_status_check" CHECK ("project_milestone"."status" in ('Planned', 'Reached', 'Abandoned')),
	CONSTRAINT "project_milestone_revision_check" CHECK ("project_milestone"."revision" >= 0),
	CONSTRAINT "project_milestone_title_check" CHECK (length(btrim("project_milestone"."title")) between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "project_milestone" ADD CONSTRAINT "project_milestone_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_milestone_project_target_date_title_idx" ON "project_milestone" USING btree ("project_id","target_date","title");