CREATE TABLE "project_wall" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_wall_title_check" CHECK (length(btrim("project_wall"."title")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "project_wall_item" (
	"density" text DEFAULT 'Preview' NOT NULL,
	"highlight" text,
	"id" text PRIMARY KEY NOT NULL,
	"placed_at" timestamp DEFAULT now() NOT NULL,
	"position_x" double precision DEFAULT 0 NOT NULL,
	"position_y" double precision DEFAULT 0 NOT NULL,
	"source_id" text NOT NULL,
	"source_type" text NOT NULL,
	"wall_id" text NOT NULL,
	CONSTRAINT "project_wall_item_source_type_check" CHECK ("project_wall_item"."source_type" in ('Work', 'Decision', 'Risk')),
	CONSTRAINT "project_wall_item_density_check" CHECK ("project_wall_item"."density" in ('Compact', 'Preview', 'Detailed')),
	CONSTRAINT "project_wall_item_highlight_check" CHECK ("project_wall_item"."highlight" is null or "project_wall_item"."highlight" in ('blue', 'green', 'amber', 'red', 'violet'))
);
--> statement-breakpoint
ALTER TABLE "project_wall" ADD CONSTRAINT "project_wall_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD CONSTRAINT "project_wall_item_wall_id_project_wall_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."project_wall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_wall_project_idx" ON "project_wall" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_wall_item_wall_source_uidx" ON "project_wall_item" USING btree ("wall_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "project_wall_item_source_idx" ON "project_wall_item" USING btree ("source_type","source_id");