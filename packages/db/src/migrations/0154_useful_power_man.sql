CREATE TABLE "diagram_record_card" (
	"id" text PRIMARY KEY NOT NULL,
	"diagram_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"x" double precision DEFAULT 0 NOT NULL,
	"y" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diagram_record_card_source_unique" UNIQUE("diagram_id","source_type","source_id"),
	CONSTRAINT "diagram_record_card_source_type_check" CHECK ("diagram_record_card"."source_type" in ('Work', 'Decision', 'Risk', 'Open Question'))
);
--> statement-breakpoint
CREATE TABLE "diagram_record_link" (
	"id" text PRIMARY KEY NOT NULL,
	"diagram_id" text NOT NULL,
	"version_id" text NOT NULL,
	"node_id" text NOT NULL,
	"record_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diagram_record_link_record_type_check" CHECK ("diagram_record_link"."record_type" in ('Work', 'Decision', 'Risk', 'Open Question'))
);
--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD COLUMN "diagram_version_id" text;--> statement-breakpoint
ALTER TABLE "diagram_record_card" ADD CONSTRAINT "diagram_record_card_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_record_link" ADD CONSTRAINT "diagram_record_link_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_record_link" ADD CONSTRAINT "diagram_record_link_version_id_diagram_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."diagram_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diagram_record_link_diagram_idx" ON "diagram_record_link" USING btree ("diagram_id");