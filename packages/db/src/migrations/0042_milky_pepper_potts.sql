CREATE TABLE "work_template" (
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"custom_field_defaults" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description_skeleton" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"project_id" text NOT NULL,
	"relative_dates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"trashed_at" timestamp,
	"type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_template_name_check" CHECK (length(btrim("work_template"."name")) > 0),
	CONSTRAINT "work_template_revision_check" CHECK ("work_template"."revision" >= 1),
	CONSTRAINT "work_template_type_check" CHECK ("work_template"."type" in ('Feature', 'Bug', 'Task', 'Research', 'Improvement'))
);
--> statement-breakpoint
ALTER TABLE "work_template" ADD CONSTRAINT "work_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_template_project_idx" ON "work_template" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_template_project_name_uidx" ON "work_template" USING btree ("project_id","name_key");