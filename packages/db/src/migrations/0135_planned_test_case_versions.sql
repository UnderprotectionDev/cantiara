CREATE TABLE "project_planned_test_case" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_planned_test_case_version_check" CHECK ("project_planned_test_case"."current_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "project_planned_test_case_relation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_revision" integer,
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"section_id" text,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	"version_id" text NOT NULL,
	CONSTRAINT "project_planned_test_case_relation_type_check" CHECK ("project_planned_test_case_relation"."target_type" in ('Work', 'Feature', 'Document', 'Decision', 'Risk', 'Project Goal', 'Milestone', 'Source', 'Screen')),
	CONSTRAINT "project_planned_test_case_relation_document_check" CHECK (("project_planned_test_case_relation"."target_type" = 'Document' and "project_planned_test_case_relation"."document_revision" is not null and "project_planned_test_case_relation"."document_revision" >= 0) or ("project_planned_test_case_relation"."target_type" <> 'Document' and "project_planned_test_case_relation"."document_revision" is null and "project_planned_test_case_relation"."section_id" is null))
);
--> statement-breakpoint
CREATE TABLE "project_planned_test_case_version" (
	"case_id" text NOT NULL,
	"change_kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expected_behavior" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"notes" text,
	"preconditions" text NOT NULL,
	"purpose" text NOT NULL,
	"scope" text NOT NULL,
	"title" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "project_planned_test_case_version_number_check" CHECK ("project_planned_test_case_version"."version" >= 1),
	CONSTRAINT "project_planned_test_case_version_kind_check" CHECK ("project_planned_test_case_version"."change_kind" in ('Initial version', 'Meaningful change', 'Editorial change')),
	CONSTRAINT "project_planned_test_case_version_title_check" CHECK (length(btrim("project_planned_test_case_version"."title")) between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "project_planned_test_case" ADD CONSTRAINT "project_planned_test_case_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_planned_test_case_relation" ADD CONSTRAINT "project_planned_test_case_relation_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_planned_test_case_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_planned_test_case_version" ADD CONSTRAINT "project_planned_test_case_version_case_fk" FOREIGN KEY ("case_id") REFERENCES "public"."project_planned_test_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_planned_test_case_project_idx" ON "project_planned_test_case" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_planned_test_case_relation_version_idx" ON "project_planned_test_case_relation" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_planned_test_case_version_uidx" ON "project_planned_test_case_version" USING btree ("case_id","version");