CREATE TABLE "project_validation_record" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"method" text NOT NULL,
	"result" text,
	"context" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_validation_record_title_check" CHECK (length(btrim("project_validation_record"."title")) between 1 and 255),
	CONSTRAINT "project_validation_record_method_check" CHECK (length(btrim("project_validation_record"."method")) between 1 and 100000),
	CONSTRAINT "project_validation_record_result_check" CHECK ("project_validation_record"."result" is null or length("project_validation_record"."result") <= 100000),
	CONSTRAINT "project_validation_record_status_check" CHECK ("project_validation_record"."status" in ('Active', 'Archived', 'Trash')),
	CONSTRAINT "project_validation_record_revision_check" CHECK ("project_validation_record"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_validation_record" ADD CONSTRAINT "project_validation_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_validation_record_project_status_idx" ON "project_validation_record" USING btree ("project_id","status");