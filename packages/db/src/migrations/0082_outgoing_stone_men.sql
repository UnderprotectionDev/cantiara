CREATE TABLE "smart_collection" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"source_type" text DEFAULT 'Work' NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "smart_collection_name_check" CHECK (length(btrim("smart_collection"."name")) between 1 and 255),
	CONSTRAINT "smart_collection_source_type_check" CHECK ("smart_collection"."source_type" = 'Work')
);
--> statement-breakpoint
CREATE TABLE "smart_collection_view" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"name" text NOT NULL,
	"presentation" text DEFAULT 'List' NOT NULL,
	"purpose" text,
	CONSTRAINT "smart_collection_view_name_unique" UNIQUE("collection_id","name"),
	CONSTRAINT "smart_collection_view_name_check" CHECK (length(btrim("smart_collection_view"."name")) between 1 and 255),
	CONSTRAINT "smart_collection_view_presentation_check" CHECK ("smart_collection_view"."presentation" in ('List', 'Table'))
);
--> statement-breakpoint
CREATE TABLE "diagram_document_origin" (
	"diagram_id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"document_revision" integer NOT NULL,
	"block_start" integer NOT NULL,
	"block_end" integer NOT NULL,
	CONSTRAINT "diagram_origin_revision_check" CHECK ("diagram_document_origin"."document_revision" >= 0),
	CONSTRAINT "diagram_origin_block_check" CHECK ("diagram_document_origin"."block_start" >= 0 and "diagram_document_origin"."block_end" > "diagram_document_origin"."block_start")
);
--> statement-breakpoint
CREATE TABLE "diagram_view" (
	"id" text PRIMARY KEY NOT NULL,
	"diagram_id" text NOT NULL,
	"name" text NOT NULL,
	"selected_node_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "diagram_view_name_unique" UNIQUE("diagram_id","name"),
	CONSTRAINT "diagram_view_name_check" CHECK (length(btrim("diagram_view"."name")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "technical_diagram" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"authority_mode" text NOT NULL,
	"model" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "technical_diagram_title_check" CHECK (length(btrim("technical_diagram"."title")) between 1 and 255),
	CONSTRAINT "technical_diagram_type_check" CHECK ("technical_diagram"."type" in ('Technical Architecture', 'Data Model', 'Technical Sequence')),
	CONSTRAINT "technical_diagram_authority_mode_check" CHECK ("technical_diagram"."authority_mode" in ('Product-authored Model', 'Imported Independent Copy', 'External Source Link'))
);
--> statement-breakpoint
ALTER TABLE "smart_collection" ADD CONSTRAINT "smart_collection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_collection_view" ADD CONSTRAINT "smart_collection_view_collection_id_smart_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."smart_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_document_origin" ADD CONSTRAINT "diagram_document_origin_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_view" ADD CONSTRAINT "diagram_view_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_diagram" ADD CONSTRAINT "technical_diagram_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "smart_collection_project_idx" ON "smart_collection" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "technical_diagram_project_idx" ON "technical_diagram" USING btree ("project_id");