CREATE TABLE "diagram_authority_origin" (
	"target_diagram_id" text PRIMARY KEY NOT NULL,
	"source_diagram_id" text NOT NULL,
	"source_mode" text NOT NULL,
	"target_mode" text NOT NULL,
	"loss" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diagram_authority_origin_distinct_check" CHECK ("diagram_authority_origin"."source_diagram_id" <> "diagram_authority_origin"."target_diagram_id" and "diagram_authority_origin"."source_mode" <> "diagram_authority_origin"."target_mode"),
	CONSTRAINT "diagram_authority_origin_modes_check" CHECK ("diagram_authority_origin"."source_mode" in ('Product-authored Model', 'Imported Independent Copy', 'External Source Link') and "diagram_authority_origin"."target_mode" in ('Product-authored Model', 'Imported Independent Copy', 'External Source Link'))
);
--> statement-breakpoint
ALTER TABLE "technical_diagram" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "technical_diagram" ADD COLUMN "external_revision" text;--> statement-breakpoint
ALTER TABLE "technical_diagram" ADD COLUMN "external_tool" text;--> statement-breakpoint
ALTER TABLE "technical_diagram" ADD COLUMN "external_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "diagram_authority_origin" ADD CONSTRAINT "diagram_authority_origin_target_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("target_diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_authority_origin" ADD CONSTRAINT "diagram_authority_origin_source_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("source_diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diagram_authority_origin_source_idx" ON "diagram_authority_origin" USING btree ("source_diagram_id");