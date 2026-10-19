CREATE TABLE "project_screen_linked_block" (
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_screen_linked_block_name_check" CHECK (length(btrim("project_screen_linked_block"."name")) between 1 and 120),
	CONSTRAINT "project_screen_linked_block_revision_check" CHECK ("project_screen_linked_block"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "project_screen_wireframe_version" ADD COLUMN "document" jsonb DEFAULT '{"format":"cantiara.wireframe-document","version":1,"canvas":{"width":1280,"height":800},"blocks":[],"linkedDefinitions":{},"animations":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_screen_linked_block" ADD CONSTRAINT "project_screen_linked_block_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_screen_linked_block_project_idx" ON "project_screen_linked_block" USING btree ("project_id");