CREATE TABLE "project_test_gap" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"rationale" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_test_gap_title_check" CHECK (length(btrim("project_test_gap"."title")) between 1 and 255),
	CONSTRAINT "project_test_gap_rationale_check" CHECK (length(btrim("project_test_gap"."rationale")) >= 1)
);
--> statement-breakpoint
CREATE TABLE "project_test_gap_relation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_revision" integer,
	"gap_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"section_id" text,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	CONSTRAINT "project_test_gap_relation_type_check" CHECK ("project_test_gap_relation"."target_type" in ('Work', 'Feature', 'Document', 'Risk', 'Project Release')),
	CONSTRAINT "project_test_gap_relation_document_check" CHECK (("project_test_gap_relation"."target_type" = 'Document' and "project_test_gap_relation"."document_revision" is not null and "project_test_gap_relation"."document_revision" >= 0) or ("project_test_gap_relation"."target_type" <> 'Document' and "project_test_gap_relation"."document_revision" is null and "project_test_gap_relation"."section_id" is null))
);
--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD CONSTRAINT "project_test_gap_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_gap_relation" ADD CONSTRAINT "project_test_gap_relation_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."project_test_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_gap_project_idx" ON "project_test_gap" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_test_gap_relation_gap_idx" ON "project_test_gap_relation" USING btree ("gap_id");