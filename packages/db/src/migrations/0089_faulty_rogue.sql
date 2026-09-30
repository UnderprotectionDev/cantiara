ALTER TABLE "document_conflict_draft" DROP CONSTRAINT "document_conflict_draft_document_id_document_id_fk";
--> statement-breakpoint
ALTER TABLE "document_conflict_draft" DROP CONSTRAINT "document_conflict_draft_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_project_scope_fk" FOREIGN KEY ("document_id","project_id") REFERENCES "public"."document"("id","project_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_workspace_scope_fk" FOREIGN KEY ("document_id","workspace_id") REFERENCES "public"."document"("id","workspace_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_scope_check" CHECK (("document_conflict_draft"."project_id" IS NOT NULL AND "document_conflict_draft"."workspace_id" IS NULL) OR ("document_conflict_draft"."project_id" IS NULL AND "document_conflict_draft"."workspace_id" IS NOT NULL));