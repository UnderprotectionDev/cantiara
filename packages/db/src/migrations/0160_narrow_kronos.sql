CREATE TABLE "diagram_version" (
	"id" text PRIMARY KEY NOT NULL,
	"diagram_id" text NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"authority_mode" text NOT NULL,
	"model" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diagram_version_number_unique" UNIQUE("diagram_id","number"),
	CONSTRAINT "diagram_version_name_unique" UNIQUE("diagram_id","name"),
	CONSTRAINT "diagram_version_name_check" CHECK (length(btrim("diagram_version"."name")) between 1 and 255),
	CONSTRAINT "diagram_version_number_check" CHECK ("diagram_version"."number" >= 1 and "diagram_version"."revision" >= 1),
	CONSTRAINT "diagram_version_authority_mode_check" CHECK ("diagram_version"."authority_mode" in ('Product-authored Model', 'Imported Independent Copy'))
);
--> statement-breakpoint
ALTER TABLE "technical_diagram" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "diagram_version" ADD CONSTRAINT "diagram_version_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;