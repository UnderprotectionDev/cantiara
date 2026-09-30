ALTER TABLE "document" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "folder" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "parent_document_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "inline_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_id_project_unique" UNIQUE("id","project_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_id_workspace_unique" UNIQUE("id","workspace_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_parent_scope_fk" FOREIGN KEY ("parent_document_id","project_id") REFERENCES "public"."document"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_parent_workspace_fk" FOREIGN KEY ("parent_document_id","workspace_id") REFERENCES "public"."document"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_parent_idx" ON "document" USING btree ("parent_document_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_parent_self_check" CHECK ("document"."parent_document_id" is null or "document"."parent_document_id" <> "document"."id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_folder_check" CHECK ("document"."folder" is null or length(btrim("document"."folder")) between 1 and 255);
