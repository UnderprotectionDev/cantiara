CREATE TABLE "file_attachment" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"lifecycle_status" text DEFAULT 'Active' NOT NULL,
	"name" text NOT NULL,
	"personal_wiki_id" text,
	"project_id" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"scope_type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "file_attachment_current_version_check" CHECK ("file_attachment"."current_version" >= 1),
	CONSTRAINT "file_attachment_lifecycle_status_check" CHECK ("file_attachment"."lifecycle_status" in ('Active', 'Archive', 'Trash')),
	CONSTRAINT "file_attachment_name_check" CHECK (length(btrim("file_attachment"."name")) > 0),
	CONSTRAINT "file_attachment_revision_check" CHECK ("file_attachment"."revision" >= 0),
	CONSTRAINT "file_attachment_scope_check" CHECK (("file_attachment"."scope_type" = 'Project' and "file_attachment"."project_id" is not null and "file_attachment"."personal_wiki_id" is null) or ("file_attachment"."scope_type" = 'Personal Wiki' and "file_attachment"."project_id" is null and "file_attachment"."personal_wiki_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "file_attachment_upload" (
	"account_id" text NOT NULL,
	"attachment_id" text,
	"base_revision" integer,
	"client_idempotency_key" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"declared_mime_type" text NOT NULL,
	"error" jsonb,
	"expires_at" timestamp NOT NULL,
	"file_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"personal_wiki_id" text,
	"project_id" text,
	"result" jsonb,
	"scope_type" text,
	"status" text DEFAULT 'staged' NOT NULL,
	"temporary_object_key" text,
	"workspace_id" text NOT NULL,
	CONSTRAINT "file_attachment_upload_base_revision_check" CHECK ("file_attachment_upload"."base_revision" is null or "file_attachment_upload"."base_revision" >= 0),
	CONSTRAINT "file_attachment_upload_mode_check" CHECK ("file_attachment_upload"."mode" in ('new', 'new-version')),
	CONSTRAINT "file_attachment_upload_payload_fingerprint_check" CHECK ("file_attachment_upload"."payload_fingerprint" ~ '^[0-9a-fA-F]{64}$'),
	CONSTRAINT "file_attachment_upload_scope_check" CHECK (("file_attachment_upload"."scope_type" is null and "file_attachment_upload"."project_id" is null and "file_attachment_upload"."personal_wiki_id" is null) or ("file_attachment_upload"."scope_type" = 'Project' and "file_attachment_upload"."project_id" is not null and "file_attachment_upload"."personal_wiki_id" is null) or ("file_attachment_upload"."scope_type" = 'Personal Wiki' and "file_attachment_upload"."project_id" is null and "file_attachment_upload"."personal_wiki_id" is not null)),
	CONSTRAINT "file_attachment_upload_status_check" CHECK ("file_attachment_upload"."status" in ('staged', 'committed', 'rejected', 'swept'))
);
--> statement-breakpoint
CREATE TABLE "file_attachment_version" (
	"attachment_id" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"detected_mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"file_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"object_key" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "file_attachment_version_byte_size_check" CHECK ("file_attachment_version"."byte_size" > 0),
	CONSTRAINT "file_attachment_version_content_hash_check" CHECK ("file_attachment_version"."content_hash" ~ '^[0-9a-fA-F]{64}$'),
	CONSTRAINT "file_attachment_version_version_check" CHECK ("file_attachment_version"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment_upload" ADD CONSTRAINT "file_attachment_upload_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment_upload" ADD CONSTRAINT "file_attachment_upload_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment_version" ADD CONSTRAINT "file_attachment_version_attachment_id_file_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."file_attachment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_attachment_workspace_idx" ON "file_attachment" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "file_attachment_scope_idx" ON "file_attachment" USING btree ("scope_type","project_id","personal_wiki_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_attachment_upload_account_key_uidx" ON "file_attachment_upload" USING btree ("account_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX "file_attachment_upload_expiry_idx" ON "file_attachment_upload" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "file_attachment_upload_workspace_idx" ON "file_attachment_upload" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "file_attachment_version_attachment_idx" ON "file_attachment_version" USING btree ("attachment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_attachment_version_attachment_number_uidx" ON "file_attachment_version" USING btree ("attachment_id","version");--> statement-breakpoint
