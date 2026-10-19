CREATE TABLE "moodboard" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "moodboard_title_check" CHECK (length(btrim("moodboard"."title")) between 1 and 255),
	CONSTRAINT "moodboard_revision_check" CHECK ("moodboard"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "moodboard_item" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"moodboard_id" text NOT NULL,
	"position" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "moodboard_item_id_kind_uidx" UNIQUE("id","kind"),
	CONSTRAINT "moodboard_item_kind_check" CHECK (length(btrim("moodboard_item"."kind")) > 0),
	CONSTRAINT "moodboard_item_position_check" CHECK ("moodboard_item"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "moodboard_visual" (
	"caption" text,
	"external_url" text,
	"file_attachment_version_id" text,
	"item_id" text PRIMARY KEY NOT NULL,
	"item_kind" text DEFAULT 'Visual' NOT NULL,
	"origin_kind" text NOT NULL,
	CONSTRAINT "moodboard_visual_item_kind_check" CHECK ("moodboard_visual"."item_kind" = 'Visual'),
	CONSTRAINT "moodboard_visual_caption_check" CHECK ("moodboard_visual"."caption" is null or length(btrim("moodboard_visual"."caption")) between 1 and 280),
	CONSTRAINT "moodboard_visual_origin_check" CHECK (("moodboard_visual"."origin_kind" = 'File Attachment version' and "moodboard_visual"."file_attachment_version_id" is not null and "moodboard_visual"."external_url" is null) or ("moodboard_visual"."origin_kind" = 'External link' and "moodboard_visual"."external_url" is not null and "moodboard_visual"."file_attachment_version_id" is null and length("moodboard_visual"."external_url") <= 2048))
);
--> statement-breakpoint
ALTER TABLE "moodboard" ADD CONSTRAINT "moodboard_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_item" ADD CONSTRAINT "moodboard_item_moodboard_id_moodboard_id_fk" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_visual" ADD CONSTRAINT "moodboard_visual_item_fk" FOREIGN KEY ("item_id","item_kind") REFERENCES "public"."moodboard_item"("id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moodboard_project_idx" ON "moodboard" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moodboard_item_moodboard_position_uidx" ON "moodboard_item" USING btree ("moodboard_id","position");--> statement-breakpoint
CREATE INDEX "moodboard_visual_version_idx" ON "moodboard_visual" USING btree ("file_attachment_version_id");