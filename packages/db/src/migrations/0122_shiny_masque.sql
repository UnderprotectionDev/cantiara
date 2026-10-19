CREATE TABLE "moodboard_focus_step" (
	"item_id" text NOT NULL,
	"moodboard_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "moodboard_focus_step_pk" PRIMARY KEY("moodboard_id","item_id"),
	CONSTRAINT "moodboard_focus_step_position_check" CHECK ("moodboard_focus_step"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "moodboard_visual_view" (
	"bound_origin" text NOT NULL,
	"crop_height" integer,
	"crop_left" integer,
	"crop_top" integer,
	"crop_width" integer,
	"item_id" text PRIMARY KEY NOT NULL,
	"item_kind" text DEFAULT 'Visual' NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "moodboard_visual_view_item_kind_check" CHECK ("moodboard_visual_view"."item_kind" = 'Visual'),
	CONSTRAINT "moodboard_visual_view_rotation_check" CHECK ("moodboard_visual_view"."rotation" in (0, 90, 180, 270)),
	CONSTRAINT "moodboard_visual_view_crop_check" CHECK (("moodboard_visual_view"."crop_left" is null and "moodboard_visual_view"."crop_top" is null and "moodboard_visual_view"."crop_width" is null and "moodboard_visual_view"."crop_height" is null) or ("moodboard_visual_view"."crop_left" >= 0 and "moodboard_visual_view"."crop_top" >= 0 and "moodboard_visual_view"."crop_width" >= 1 and "moodboard_visual_view"."crop_height" >= 1 and "moodboard_visual_view"."crop_left" + "moodboard_visual_view"."crop_width" <= 10000 and "moodboard_visual_view"."crop_top" + "moodboard_visual_view"."crop_height" <= 10000))
);
--> statement-breakpoint
ALTER TABLE "moodboard_focus_step" ADD CONSTRAINT "moodboard_focus_step_item_id_moodboard_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."moodboard_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_focus_step" ADD CONSTRAINT "moodboard_focus_step_moodboard_id_moodboard_id_fk" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_visual_view" ADD CONSTRAINT "moodboard_visual_view_item_fk" FOREIGN KEY ("item_id","item_kind") REFERENCES "public"."moodboard_item"("id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moodboard_focus_step_position_uidx" ON "moodboard_focus_step" USING btree ("moodboard_id","position");