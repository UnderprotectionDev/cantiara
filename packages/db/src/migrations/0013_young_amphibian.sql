CREATE TABLE "capture_inbox_operation" (
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fingerprint" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"operation_key" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "capture_inbox_operation_kind_check" CHECK ("capture_inbox_operation"."kind" in ('preview', 'merge', 'completed'))
);
--> statement-breakpoint
ALTER TABLE "capture_inbox_operation" ADD CONSTRAINT "capture_inbox_operation_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_inbox_operation_account_kind_key_uidx" ON "capture_inbox_operation" USING btree ("account_id","kind","operation_key");