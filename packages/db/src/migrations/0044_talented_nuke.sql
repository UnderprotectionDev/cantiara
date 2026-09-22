CREATE TABLE "priority_metric_definition" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"project_id" text NOT NULL,
	"rank_descriptions" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"short_description" text NOT NULL,
	"trashed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "priority_metric_definition_project_id_uidx" UNIQUE("project_id","id"),
	CONSTRAINT "priority_metric_definition_name_check" CHECK (length(btrim("priority_metric_definition"."name")) between 1 and 200),
	CONSTRAINT "priority_metric_definition_short_description_check" CHECK (length(btrim("priority_metric_definition"."short_description")) between 1 and 500),
	CONSTRAINT "priority_metric_definition_rank_descriptions_check" CHECK (jsonb_typeof("priority_metric_definition"."rank_descriptions") = 'object'
        and "priority_metric_definition"."rank_descriptions" ?& array['Very low', 'Low', 'Medium', 'High', 'Very high']
        and "priority_metric_definition"."rank_descriptions" - array['Very low', 'Low', 'Medium', 'High', 'Very high'] = '{}'::jsonb),
	CONSTRAINT "priority_metric_definition_revision_check" CHECK ("priority_metric_definition"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_priority_metric_value" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metric_id" text NOT NULL,
	"project_id" text NOT NULL,
	"rank" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "work_priority_metric_value_rank_check" CHECK ("work_priority_metric_value"."rank" in ('Very low', 'Low', 'Medium', 'High', 'Very high')),
	CONSTRAINT "work_priority_metric_value_revision_check" CHECK ("work_priority_metric_value"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_project_id_uidx" UNIQUE("project_id","id");
--> statement-breakpoint
ALTER TABLE "priority_metric_definition" ADD CONSTRAINT "priority_metric_definition_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_priority_metric_value" ADD CONSTRAINT "work_priority_metric_value_project_metric_fk" FOREIGN KEY ("project_id","metric_id") REFERENCES "public"."priority_metric_definition"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_priority_metric_value" ADD CONSTRAINT "work_priority_metric_value_project_work_fk" FOREIGN KEY ("project_id","work_id") REFERENCES "public"."work"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "priority_metric_definition_project_idx" ON "priority_metric_definition" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "priority_metric_definition_project_name_uidx" ON "priority_metric_definition" USING btree ("project_id","name_key");--> statement-breakpoint
CREATE INDEX "work_priority_metric_value_project_work_idx" ON "work_priority_metric_value" USING btree ("project_id","work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_priority_metric_value_work_metric_uidx" ON "work_priority_metric_value" USING btree ("work_id","metric_id");--> statement-breakpoint
