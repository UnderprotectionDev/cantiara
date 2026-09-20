CREATE TABLE "usage_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"location" jsonb,
	"revision" integer DEFAULT 1 NOT NULL,
	"source_record_id" text NOT NULL,
	"source_record_type" text NOT NULL,
	"surface_record_id" text NOT NULL,
	"surface_record_type" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "usage_link_kind_check" CHECK ("usage_link"."kind" in ('Inline reference', 'Section reference', 'Live block', 'Pinned bind', 'Screen reference')),
	CONSTRAINT "usage_link_revision_check" CHECK ("usage_link"."revision" >= 1),
	CONSTRAINT "usage_link_source_record_id_check" CHECK (length(btrim("usage_link"."source_record_id")) > 0),
	CONSTRAINT "usage_link_source_record_type_check" CHECK (length(btrim("usage_link"."source_record_type")) > 0),
	CONSTRAINT "usage_link_surface_record_id_check" CHECK (length(btrim("usage_link"."surface_record_id")) > 0),
	CONSTRAINT "usage_link_surface_record_type_check" CHECK (length(btrim("usage_link"."surface_record_type")) > 0)
);
--> statement-breakpoint
ALTER TABLE "usage_link" ADD CONSTRAINT "usage_link_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_link_workspace_source_idx" ON "usage_link" USING btree ("workspace_id","source_record_type","source_record_id");--> statement-breakpoint
CREATE INDEX "usage_link_workspace_surface_idx" ON "usage_link" USING btree ("workspace_id","surface_record_type","surface_record_id");