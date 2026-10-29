CREATE TABLE "build_in_public_setting" (
	"enabled" boolean DEFAULT false NOT NULL,
	"project_id" text PRIMARY KEY NOT NULL,
	"status_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "build_in_public_setting_status_map_check" CHECK (jsonb_typeof("build_in_public_setting"."status_map") = 'object')
);
--> statement-breakpoint
CREATE TABLE "build_in_public_slug" (
	"canonical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"surface_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "build_in_public_slug_pk" PRIMARY KEY("workspace_id","slug"),
	CONSTRAINT "build_in_public_slug_check" CHECK ("build_in_public_slug"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("build_in_public_slug"."slug") <= 80)
);
--> statement-breakpoint
CREATE TABLE "build_in_public_work_copy" (
	"due_date_presentation" text DEFAULT 'Hidden' NOT NULL,
	"project_id" text NOT NULL,
	"public_status_label" text,
	"public_summary" text,
	"public_title" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"work_id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "build_in_public_work_copy_title_check" CHECK ("build_in_public_work_copy"."public_title" is null or length(btrim("build_in_public_work_copy"."public_title")) between 1 and 120),
	CONSTRAINT "build_in_public_work_copy_summary_check" CHECK ("build_in_public_work_copy"."public_summary" is null or length(btrim("build_in_public_work_copy"."public_summary")) between 1 and 300),
	CONSTRAINT "build_in_public_work_copy_due_date_check" CHECK ("build_in_public_work_copy"."due_date_presentation" in ('Full date', 'Month', 'Quarter', 'Hidden')),
	CONSTRAINT "build_in_public_work_copy_label_check" CHECK ("build_in_public_work_copy"."public_status_label" is null or length(btrim("build_in_public_work_copy"."public_status_label")) between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "build_in_public_setting" ADD CONSTRAINT "build_in_public_setting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_setting" ADD CONSTRAINT "build_in_public_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_slug" ADD CONSTRAINT "build_in_public_slug_surface_id_external_surface_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."external_surface"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_slug" ADD CONSTRAINT "build_in_public_slug_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_work_copy" ADD CONSTRAINT "build_in_public_work_copy_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_work_copy" ADD CONSTRAINT "build_in_public_work_copy_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "build_in_public_slug_canonical_uidx" ON "build_in_public_slug" USING btree ("surface_id") WHERE "build_in_public_slug"."canonical";