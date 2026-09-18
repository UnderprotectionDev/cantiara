CREATE TABLE "capture_extension_link" (
	"account_id" text NOT NULL,
	"browser" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"device" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_use" timestamp,
	"revoked_at" timestamp,
	"token_hash" text NOT NULL,
	CONSTRAINT "capture_extension_link_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "capture_extension_link_browser_check" CHECK ("capture_extension_link"."browser" in ('Chrome', 'Edge', 'Brave', 'Arc', 'Firefox'))
);
--> statement-breakpoint
CREATE TABLE "capture_extension_pairing_code" (
	"account_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "capture_extension_pairing_code_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "capture_extension_link" ADD CONSTRAINT "capture_extension_link_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_extension_pairing_code" ADD CONSTRAINT "capture_extension_pairing_code_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_extension_link_account_idx" ON "capture_extension_link" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "capture_extension_pairing_account_expires_idx" ON "capture_extension_pairing_code" USING btree ("account_id","expires_at");