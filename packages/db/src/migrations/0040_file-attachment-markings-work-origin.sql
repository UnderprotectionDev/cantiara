CREATE TABLE "file_attachment_marking" (
	"account_id" text NOT NULL,
	"attachment_id" text NOT NULL,
	"client_idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"geometry" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"tool" text NOT NULL,
	"undone_at" timestamp,
	"version_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "file_attachment_marking_payload_fingerprint_check" CHECK ("file_attachment_marking"."payload_fingerprint" ~ '^[0-9a-fA-F]{64}$'),
	CONSTRAINT "file_attachment_marking_tool_check" CHECK ("file_attachment_marking"."tool" in ('pen', 'highlighter', 'arrow', 'rectangle'))
);
--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "origin_location" jsonb;--> statement-breakpoint
ALTER TABLE "file_attachment_marking" ADD CONSTRAINT "file_attachment_marking_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment_marking" ADD CONSTRAINT "file_attachment_marking_attachment_id_file_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."file_attachment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment_marking" ADD CONSTRAINT "file_attachment_marking_version_id_file_attachment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."file_attachment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment_marking" ADD CONSTRAINT "file_attachment_marking_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_attachment_marking_account_key_uidx" ON "file_attachment_marking" USING btree ("account_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX "file_attachment_marking_attachment_version_idx" ON "file_attachment_marking" USING btree ("attachment_id","version_id");--> statement-breakpoint
CREATE INDEX "file_attachment_marking_workspace_idx" ON "file_attachment_marking" USING btree ("workspace_id");