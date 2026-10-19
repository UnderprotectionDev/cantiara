CREATE TABLE "moodboard_color_swatch" (
	"color" text NOT NULL,
	"item_id" text PRIMARY KEY NOT NULL,
	"item_kind" text DEFAULT 'Color Swatch' NOT NULL,
	"moodboard_id" text NOT NULL,
	"note" text,
	"palette_group_id" text,
	CONSTRAINT "moodboard_color_swatch_item_kind_check" CHECK ("moodboard_color_swatch"."item_kind" = 'Color Swatch'),
	CONSTRAINT "moodboard_color_swatch_color_check" CHECK ("moodboard_color_swatch"."color" ~ '^#[0-9A-F]{6}$'),
	CONSTRAINT "moodboard_color_swatch_note_check" CHECK ("moodboard_color_swatch"."note" is null or length(btrim("moodboard_color_swatch"."note")) between 1 and 140)
);
--> statement-breakpoint
CREATE TABLE "moodboard_palette_group" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"moodboard_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "moodboard_palette_group_id_moodboard_uidx" UNIQUE("id","moodboard_id"),
	CONSTRAINT "moodboard_palette_group_name_check" CHECK (length(btrim("moodboard_palette_group"."name")) between 1 and 80),
	CONSTRAINT "moodboard_palette_group_position_check" CHECK ("moodboard_palette_group"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "moodboard_color_swatch" ADD CONSTRAINT "moodboard_color_swatch_item_fk" FOREIGN KEY ("item_id","item_kind") REFERENCES "public"."moodboard_item"("id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_color_swatch" ADD CONSTRAINT "moodboard_color_swatch_group_fk" FOREIGN KEY ("palette_group_id","moodboard_id") REFERENCES "public"."moodboard_palette_group"("id","moodboard_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_palette_group" ADD CONSTRAINT "moodboard_palette_group_moodboard_id_moodboard_id_fk" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moodboard_color_swatch_group_idx" ON "moodboard_color_swatch" USING btree ("palette_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moodboard_palette_group_position_uidx" ON "moodboard_palette_group" USING btree ("moodboard_id","position");