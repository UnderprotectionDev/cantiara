ALTER TABLE "document" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_wiki_updated_idx" ON "document" USING btree ("workspace_id","updated_at");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_ownership_check" CHECK (("document"."project_id" IS NOT NULL AND "document"."workspace_id" IS NULL) OR ("document"."project_id" IS NULL AND "document"."workspace_id" IS NOT NULL));