CREATE TABLE "custom_field_value" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"definition_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "custom_field_value_revision_check" CHECK ("custom_field_value"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "custom_field_definition" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_definition_id_custom_field_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_value_record_idx" ON "custom_field_value" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_value_definition_record_uidx" ON "custom_field_value" USING btree ("definition_id","record_id");