CREATE TABLE "source_check" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"revision" integer NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "source_check_revision_check" CHECK ("source_check"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "source_check" ADD CONSTRAINT "source_check_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_check_source_idx" ON "source_check" USING btree ("source_id");