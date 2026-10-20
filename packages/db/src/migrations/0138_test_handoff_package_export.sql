CREATE TABLE "project_test_handoff_ad_hoc_scope" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expected_behavior" text NOT NULL,
	"handoff_id" text NOT NULL,
	"intent" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "project_test_handoff_ad_hoc_scope_pk" PRIMARY KEY("handoff_id","position")
);
--> statement-breakpoint
CREATE TABLE "project_test_handoff_context_ref" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_revision" integer,
	"handoff_id" text NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"section_id" text,
	"target_id" text NOT NULL,
	"wireframe_version" integer,
	CONSTRAINT "project_test_handoff_context_ref_pk" PRIMARY KEY("handoff_id","position"),
	CONSTRAINT "project_test_handoff_context_ref_kind_check" CHECK ("project_test_handoff_context_ref"."kind" in ('Work', 'Feature', 'Document', 'Wireframe')),
	CONSTRAINT "project_test_handoff_context_ref_exact_check" CHECK (("project_test_handoff_context_ref"."kind" = 'Document' and "project_test_handoff_context_ref"."document_revision" is not null and "project_test_handoff_context_ref"."document_revision" >= 0 and "project_test_handoff_context_ref"."wireframe_version" is null) or ("project_test_handoff_context_ref"."kind" = 'Wireframe' and "project_test_handoff_context_ref"."wireframe_version" is not null and "project_test_handoff_context_ref"."wireframe_version" >= 1 and "project_test_handoff_context_ref"."document_revision" is null and "project_test_handoff_context_ref"."section_id" is null) or ("project_test_handoff_context_ref"."kind" in ('Work', 'Feature') and "project_test_handoff_context_ref"."document_revision" is null and "project_test_handoff_context_ref"."section_id" is null and "project_test_handoff_context_ref"."wireframe_version" is null))
);
--> statement-breakpoint
CREATE TABLE "project_test_handoff_package" (
	"created_at" timestamp NOT NULL,
	"handoff_id" text NOT NULL,
	"json" text NOT NULL,
	"markdown" text NOT NULL,
	"package_version" integer NOT NULL,
	CONSTRAINT "project_test_handoff_package_pk" PRIMARY KEY("handoff_id","package_version"),
	CONSTRAINT "project_test_handoff_package_version_check" CHECK ("project_test_handoff_package"."package_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "project_test_handoff" ADD COLUMN "environment_preconditions" text;--> statement-breakpoint
ALTER TABLE "project_test_handoff_ad_hoc_scope" ADD CONSTRAINT "project_test_handoff_ad_hoc_scope_handoff_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_test_handoff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_handoff_context_ref" ADD CONSTRAINT "project_test_handoff_context_ref_handoff_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_test_handoff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_handoff_package" ADD CONSTRAINT "project_test_handoff_package_handoff_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_test_handoff"("id") ON DELETE cascade ON UPDATE no action;