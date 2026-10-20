CREATE TABLE "project_wall_group" (
	"collapsed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"wall_id" text NOT NULL,
	CONSTRAINT "project_wall_group_title_check" CHECK (length(btrim("project_wall_group"."title")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "project_wall_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"from_item_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"to_item_id" text NOT NULL,
	"wall_id" text NOT NULL,
	CONSTRAINT "project_wall_link_label_check" CHECK (length(btrim("project_wall_link"."label")) between 1 and 120),
	CONSTRAINT "project_wall_link_distinct_check" CHECK ("project_wall_link"."from_item_id" <> "project_wall_link"."to_item_id")
);
--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_wall_group" ADD CONSTRAINT "project_wall_group_wall_id_project_wall_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."project_wall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wall_link" ADD CONSTRAINT "project_wall_link_from_item_id_project_wall_item_id_fk" FOREIGN KEY ("from_item_id") REFERENCES "public"."project_wall_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wall_link" ADD CONSTRAINT "project_wall_link_to_item_id_project_wall_item_id_fk" FOREIGN KEY ("to_item_id") REFERENCES "public"."project_wall_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wall_link" ADD CONSTRAINT "project_wall_link_wall_id_project_wall_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."project_wall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_wall_group_wall_idx" ON "project_wall_group" USING btree ("wall_id");--> statement-breakpoint
CREATE INDEX "project_wall_link_wall_idx" ON "project_wall_link" USING btree ("wall_id");--> statement-breakpoint
CREATE INDEX "project_wall_link_from_idx" ON "project_wall_link" USING btree ("from_item_id");--> statement-breakpoint
CREATE INDEX "project_wall_link_to_idx" ON "project_wall_link" USING btree ("to_item_id");--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD CONSTRAINT "project_wall_item_group_id_project_wall_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."project_wall_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_wall_item_group_idx" ON "project_wall_item" USING btree ("group_id");