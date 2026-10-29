CREATE TABLE "build_in_public_setting" (
	"enabled" boolean DEFAULT false NOT NULL,
	"project_id" text PRIMARY KEY NOT NULL,
	"status_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "build_in_public_setting_status_map_check" CHECK (jsonb_typeof("build_in_public_setting"."status_map") = 'object')
);
--> statement-breakpoint
CREATE TABLE "build_in_public_work_copy" (
	"project_id" text NOT NULL,
	"public_status_label" text,
	"public_summary" text,
	"public_title" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"work_id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "build_in_public_work_copy_title_check" CHECK ("build_in_public_work_copy"."public_title" is null or length(btrim("build_in_public_work_copy"."public_title")) between 1 and 120),
	CONSTRAINT "build_in_public_work_copy_summary_check" CHECK ("build_in_public_work_copy"."public_summary" is null or length(btrim("build_in_public_work_copy"."public_summary")) between 1 and 300),
	CONSTRAINT "build_in_public_work_copy_label_check" CHECK ("build_in_public_work_copy"."public_status_label" is null or length(btrim("build_in_public_work_copy"."public_status_label")) between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "build_in_public_setting" ADD CONSTRAINT "build_in_public_setting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_setting" ADD CONSTRAINT "build_in_public_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_work_copy" ADD CONSTRAINT "build_in_public_work_copy_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_work_copy" ADD CONSTRAINT "build_in_public_work_copy_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;