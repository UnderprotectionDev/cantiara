CREATE TABLE "roadmap_view" (
	"group_by" text NOT NULL,
	"horizons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mark_by" text NOT NULL,
	"name" text NOT NULL,
	"project_id" text NOT NULL,
	"types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_view_name_check" CHECK (length(btrim("roadmap_view"."name")) > 0),
	CONSTRAINT "roadmap_view_group_check" CHECK ("roadmap_view"."group_by" in ('Horizon', 'Type', 'Status')),
	CONSTRAINT "roadmap_view_mark_check" CHECK ("roadmap_view"."mark_by" in ('Horizon', 'Type', 'Status'))
);
--> statement-breakpoint
ALTER TABLE "roadmap_view" ADD CONSTRAINT "roadmap_view_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roadmap_view_project_idx" ON "roadmap_view" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_view_project_name_uidx" ON "roadmap_view" USING btree ("project_id","name");