CREATE TABLE "data_import_origin" (
	"account_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"origin_key" text NOT NULL,
	"provenance" text NOT NULL,
	"receipt_key" text NOT NULL,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"scope_kind" text NOT NULL,
	CONSTRAINT "data_import_origin_scope_check" CHECK ("data_import_origin"."scope_kind" in ('project', 'wiki', 'workspace'))
);
--> statement-breakpoint
CREATE TABLE "data_import_receipt" (
	"account_id" text NOT NULL,
	"catalog_type" text,
	"completed_at" timestamp NOT NULL,
	"counts" jsonb NOT NULL,
	"family" text NOT NULL,
	"file_name" text NOT NULL,
	"final_set_fingerprint" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"provenance" text,
	"reason" text,
	"scope_label" text NOT NULL,
	"status" text NOT NULL,
	"support_reference" text,
	CONSTRAINT "data_import_receipt_status_check" CHECK ("data_import_receipt"."status" in ('committed', 'rolled-back'))
);
--> statement-breakpoint
ALTER TABLE "data_import_staging" ADD COLUMN "applying_key" text;--> statement-breakpoint
ALTER TABLE "data_import_origin" ADD CONSTRAINT "data_import_origin_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_receipt" ADD CONSTRAINT "data_import_receipt_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_import_origin_match_idx" ON "data_import_origin" USING btree ("account_id","scope_kind","scope_id","record_type","provenance","origin_key");--> statement-breakpoint
CREATE INDEX "data_import_origin_record_idx" ON "data_import_origin" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_import_receipt_key_uidx" ON "data_import_receipt" USING btree ("account_id","idempotency_key");