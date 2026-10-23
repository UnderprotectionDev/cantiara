CREATE TABLE "project_release_audience" (
	"company_id" text,
	"contact_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"persona_document_id" text,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"removed_at" timestamp,
	"revision" integer DEFAULT 0 NOT NULL,
	"target_type" text NOT NULL,
	CONSTRAINT "project_release_audience_target_type_check" CHECK ("project_release_audience"."target_type" in ('Persona', 'Contact', 'Company')),
	CONSTRAINT "project_release_audience_target_check" CHECK (("project_release_audience"."target_type" = 'Persona' and "project_release_audience"."persona_document_id" is not null and "project_release_audience"."contact_id" is null and "project_release_audience"."company_id" is null) or ("project_release_audience"."target_type" = 'Contact' and "project_release_audience"."contact_id" is not null and "project_release_audience"."persona_document_id" is null and "project_release_audience"."company_id" is null) or ("project_release_audience"."target_type" = 'Company' and "project_release_audience"."company_id" is not null and "project_release_audience"."persona_document_id" is null and "project_release_audience"."contact_id" is null)),
	CONSTRAINT "project_release_audience_revision_check" CHECK ("project_release_audience"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_release_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"removed_at" timestamp,
	"repository_link_id" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"url" text,
	CONSTRAINT "project_release_link_kind_check" CHECK ("project_release_link"."kind" in ('Tag', 'Release', 'Environment link')),
	CONSTRAINT "project_release_link_repository_check" CHECK ("project_release_link"."kind" = 'Environment link' or "project_release_link"."repository_link_id" is not null),
	CONSTRAINT "project_release_link_label_check" CHECK (length(btrim("project_release_link"."label")) between 1 and 255),
	CONSTRAINT "project_release_link_url_check" CHECK ("project_release_link"."url" is null or length("project_release_link"."url") between 1 and 2048),
	CONSTRAINT "project_release_link_revision_check" CHECK ("project_release_link"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_release_scope" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"removed_at" timestamp,
	"revision" integer DEFAULT 0 NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "project_release_scope_revision_check" CHECK ("project_release_scope"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_release" ADD COLUMN "access_evidence" text;--> statement-breakpoint
ALTER TABLE "project_release" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "project_release" ADD COLUMN "intended_outcome" text;--> statement-breakpoint
ALTER TABLE "project_release" ADD COLUMN "outcome_evidence" text;--> statement-breakpoint
ALTER TABLE "project_release" ADD COLUMN "primary_access_path" text;--> statement-breakpoint
ALTER TABLE "project_release_audience" ADD CONSTRAINT "project_release_audience_company_id_workspace_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."workspace_company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_audience" ADD CONSTRAINT "project_release_audience_contact_id_workspace_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."workspace_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_audience" ADD CONSTRAINT "project_release_audience_persona_document_id_document_id_fk" FOREIGN KEY ("persona_document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_audience" ADD CONSTRAINT "project_release_audience_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_audience" ADD CONSTRAINT "project_release_audience_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_link" ADD CONSTRAINT "project_release_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_link" ADD CONSTRAINT "project_release_link_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_link" ADD CONSTRAINT "project_release_link_repository_link_id_project_github_repository_link_id_fk" FOREIGN KEY ("repository_link_id") REFERENCES "public"."project_github_repository_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_scope" ADD CONSTRAINT "project_release_scope_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_scope" ADD CONSTRAINT "project_release_scope_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_scope" ADD CONSTRAINT "project_release_scope_work_fk" FOREIGN KEY ("project_id","work_id") REFERENCES "public"."work"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_release_audience_release_idx" ON "project_release_audience" USING btree ("project_id","release_id");--> statement-breakpoint
CREATE INDEX "project_release_link_release_idx" ON "project_release_link" USING btree ("project_id","release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_release_scope_release_work_uidx" ON "project_release_scope" USING btree ("release_id","work_id");--> statement-breakpoint
CREATE INDEX "project_release_scope_project_work_idx" ON "project_release_scope" USING btree ("project_id","work_id");