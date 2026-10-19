CREATE TABLE "project_screen_block_origin" (
	"actor_id" text NOT NULL,
	"block_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"screen_id" text NOT NULL,
	"superseded_at" timestamp,
	"supersedes_id" text,
	"target_record_id" text NOT NULL,
	"target_type" text NOT NULL,
	"wireframe_version" integer NOT NULL,
	CONSTRAINT "project_screen_block_origin_target_type_check" CHECK ("project_screen_block_origin"."target_type" in ('Work', 'Decision', 'Risk', 'Open Question')),
	CONSTRAINT "project_screen_block_origin_version_check" CHECK ("project_screen_block_origin"."wireframe_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "workspace_screen_wireframe_template" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_screen_wireframe_template_name_check" CHECK (length(btrim("workspace_screen_wireframe_template"."name")) between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "project_screen_block_origin" ADD CONSTRAINT "project_screen_block_origin_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_screen_block_origin" ADD CONSTRAINT "project_screen_block_origin_screen_id_project_screen_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."project_screen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_screen_block_origin" ADD CONSTRAINT "project_screen_block_origin_version_fk" FOREIGN KEY ("screen_id","wireframe_version") REFERENCES "public"."project_screen_wireframe_version"("screen_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_screen_wireframe_template" ADD CONSTRAINT "workspace_screen_wireframe_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_screen_block_origin_screen_idx" ON "project_screen_block_origin" USING btree ("screen_id","wireframe_version");--> statement-breakpoint
CREATE UNIQUE INDEX "project_screen_block_origin_current_target_uidx" ON "project_screen_block_origin" USING btree ("target_type","target_record_id") WHERE "project_screen_block_origin"."superseded_at" is null;--> statement-breakpoint
CREATE INDEX "workspace_screen_wireframe_template_workspace_idx" ON "workspace_screen_wireframe_template" USING btree ("workspace_id");