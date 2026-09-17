CREATE TABLE "capture_inbox_item" (
	"account_id" text NOT NULL,
	"client_idempotency_key" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fields" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"payload_fingerprint" text,
	"project_id" text,
	"template" text,
	CONSTRAINT "capture_inbox_item_template_check" CHECK ("capture_inbox_item"."template" is null or "capture_inbox_item"."template" in ('Bug Capture', 'Feedback Capture', 'Research Fragment'))
);
--> statement-breakpoint
ALTER TABLE "capture_inbox_item" ADD CONSTRAINT "capture_inbox_item_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_inbox_item_account_project_created_idx" ON "capture_inbox_item" USING btree ("account_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "capture_inbox_item_idempotency_uidx" ON "capture_inbox_item" USING btree ("account_id","client_idempotency_key");