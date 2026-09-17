CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"short_code" text NOT NULL,
	"starter_configuration" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"purpose" text,
	"problem" text,
	"scope" text,
	"target_date" date,
	"logo" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"work_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_short_code_format_check" CHECK ("project"."short_code" ~ '^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$'),
	CONSTRAINT "project_starter_configuration_check" CHECK ("project"."starter_configuration" in ('Blank Project', 'Solo SaaS', 'Open Source Library', 'Mobile Application')),
	CONSTRAINT "project_status_check" CHECK ("project"."status" in ('Active', 'Pending', 'Completed', 'Abandoned')),
	CONSTRAINT "project_work_count_check" CHECK ("project"."work_count" >= 0),
	CONSTRAINT "project_revision_check" CHECK ("project"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_short_code" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"short_code" text NOT NULL,
	"reserved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_short_code_format_check" CHECK ("project_short_code"."short_code" ~ '^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_short_code" ADD CONSTRAINT "project_short_code_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_short_code" ADD CONSTRAINT "project_short_code_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_workspace_idx" ON "project" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspace_short_code_uidx" ON "project" USING btree ("workspace_id","short_code");--> statement-breakpoint
CREATE INDEX "project_short_code_project_idx" ON "project_short_code" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_short_code_workspace_code_uidx" ON "project_short_code" USING btree ("workspace_id","short_code");