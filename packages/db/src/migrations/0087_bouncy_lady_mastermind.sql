CREATE TABLE "document_template" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"workspace_id" text,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'General' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_template_scope_check" CHECK (("document_template"."project_id" IS NULL) <> ("document_template"."workspace_id" IS NULL)),
	CONSTRAINT "document_template_name_check" CHECK (length(btrim("document_template"."name")) between 1 and 255),
	CONSTRAINT "document_template_body_check" CHECK (length("document_template"."body") <= 1000000),
	CONSTRAINT "document_template_type_check" CHECK ("document_template"."type" in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona')),
	CONSTRAINT "document_template_revision_check" CHECK ("document_template"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_template_project_idx" ON "document_template" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "document_template_wiki_idx" ON "document_template" USING btree ("workspace_id");