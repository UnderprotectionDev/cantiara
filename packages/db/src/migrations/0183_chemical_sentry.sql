CREATE TABLE "trash_entry" (
	"actor_account_id" text NOT NULL,
	"base_revision" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"group_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"idempotency_scope" text NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"project_id" text NOT NULL,
	"record_id" text NOT NULL,
	"record_kind" text NOT NULL,
	"record_label" text NOT NULL,
	"trashed_at" timestamp NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "trash_entry_record_kind_check" CHECK ("trash_entry"."record_kind" in ('Work', 'Document', 'Decision', 'Risk', 'Screen')),
	CONSTRAINT "trash_entry_retention_check" CHECK ("trash_entry"."expires_at" = "trash_entry"."trashed_at" + interval '720 hours'),
	CONSTRAINT "trash_entry_base_revision_check" CHECK ("trash_entry"."base_revision" >= 0),
	CONSTRAINT "trash_entry_label_check" CHECK (length("trash_entry"."record_label") between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_decision" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_risk" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "trash_entry" ADD CONSTRAINT "trash_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trash_entry" ADD CONSTRAINT "trash_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trash_entry_record_uidx" ON "trash_entry" USING btree ("project_id","record_kind","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trash_entry_idempotency_uidx" ON "trash_entry" USING btree ("idempotency_scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "trash_entry_project_expires_idx" ON "trash_entry" USING btree ("project_id","expires_at");--> statement-breakpoint
CREATE INDEX "trash_entry_group_idx" ON "trash_entry" USING btree ("group_id");