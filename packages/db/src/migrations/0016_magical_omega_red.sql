CREATE TABLE "capture_inbox_bulk_view" (
	"account_id" text PRIMARY KEY NOT NULL,
	"clusters" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"placements" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_inbox_bulk_view_revision_check" CHECK ("capture_inbox_bulk_view"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "capture_inbox_bulk_view" ADD CONSTRAINT "capture_inbox_bulk_view_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;