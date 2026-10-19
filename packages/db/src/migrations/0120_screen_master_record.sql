CREATE TABLE "project_screen" (
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"trashed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_screen_title_check" CHECK (length(btrim("project_screen"."title")) between 1 and 255),
	CONSTRAINT "project_screen_revision_check" CHECK ("project_screen"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "project_screen_wireframe_version" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"screen_id" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "project_screen_wireframe_version_check" CHECK ("project_screen_wireframe_version"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "project_screen" ADD CONSTRAINT "project_screen_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_screen_wireframe_version" ADD CONSTRAINT "project_screen_wireframe_version_screen_id_project_screen_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."project_screen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_screen_project_idx" ON "project_screen" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_screen_wireframe_version_uidx" ON "project_screen_wireframe_version" USING btree ("screen_id","version");