CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'General' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_title_check" CHECK (length(btrim("document"."title")) between 1 and 255),
	CONSTRAINT "document_type_check" CHECK ("document"."type" in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona')),
	CONSTRAINT "document_revision_check" CHECK ("document"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_project_updated_idx" ON "document" USING btree ("project_id","updated_at");