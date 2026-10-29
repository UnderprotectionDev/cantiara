CREATE TABLE "trash_restore_receipt" (
	"idempotency_key" text NOT NULL,
	"idempotency_scope" text NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"project_id" text NOT NULL,
	"restored_at" timestamp NOT NULL,
	"result" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trash_restore_receipt" ADD CONSTRAINT "trash_restore_receipt_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trash_restore_receipt_idempotency_uidx" ON "trash_restore_receipt" USING btree ("idempotency_scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "trash_restore_receipt_project_idx" ON "trash_restore_receipt" USING btree ("project_id");