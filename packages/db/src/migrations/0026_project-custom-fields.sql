CREATE TABLE "custom_field_definition" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_id" text NOT NULL,
	"record_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_definition_name_check" CHECK (length(btrim("custom_field_definition"."name")) > 0),
	CONSTRAINT "custom_field_definition_type_check" CHECK ("custom_field_definition"."type" in ('Text', 'Number', 'Boolean', 'Date', 'Single select', 'Multi select')),
	CONSTRAINT "custom_field_definition_revision_check" CHECK ("custom_field_definition"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "custom_field_definition" ADD CONSTRAINT "custom_field_definition_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_definition_project_idx" ON "custom_field_definition" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_definition_project_name_uidx" ON "custom_field_definition" USING btree ("project_id","name_key");