CREATE TABLE "document_conflict_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"project_id" text NOT NULL,
	"base_revision" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text NOT NULL,
	"client_idempotency_key" text NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "document_conflict_draft_revision_check" CHECK ("document_conflict_draft"."base_revision" > 0),
	CONSTRAINT "document_conflict_draft_type_check" CHECK ("document_conflict_draft"."type" in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona'))
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "origin_document_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "origin_revision" integer;--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_conflict_draft" ADD CONSTRAINT "document_conflict_draft_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_conflict_draft_request_idx" ON "document_conflict_draft" USING btree ("document_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX "document_conflict_draft_document_idx" ON "document_conflict_draft" USING btree ("document_id","resolved_at");