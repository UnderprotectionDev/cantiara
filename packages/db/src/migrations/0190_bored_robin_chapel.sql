CREATE TABLE "data_import_staging" (
	"account_id" text NOT NULL,
	"byte_size" integer NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key_version" integer NOT NULL,
	"request" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"wrapped_data_key" text NOT NULL,
	CONSTRAINT "data_import_staging_window_check" CHECK ("data_import_staging"."expires_at" <= "data_import_staging"."created_at" + interval '24 hours'),
	CONSTRAINT "data_import_staging_size_check" CHECK ("data_import_staging"."byte_size" between 1 and 26214400),
	CONSTRAINT "data_import_staging_rows_check" CHECK ("data_import_staging"."row_count" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "data_import_staging" ADD CONSTRAINT "data_import_staging_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_import_staging_expires_idx" ON "data_import_staging" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "data_import_staging_account_idx" ON "data_import_staging" USING btree ("account_id");