CREATE TABLE "project_github_external_record" (
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"github_id" bigint NOT NULL,
	"html_url" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"link_id" text NOT NULL,
	"milestone" text,
	"number" integer NOT NULL,
	"project_id" text NOT NULL,
	"source_state" text NOT NULL,
	"source_updated_at" timestamp NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "project_github_external_record_kind_check" CHECK ("project_github_external_record"."kind" in ('Issue', 'Pull request')),
	CONSTRAINT "project_github_external_record_state_check" CHECK ("project_github_external_record"."source_state" in ('open', 'closed', 'merged'))
);
--> statement-breakpoint
CREATE TABLE "project_github_installation" (
	"account_login" text NOT NULL,
	"connected_by_account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" bigint NOT NULL,
	"project_id" text NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_github_installation_credential" (
	"ciphertext" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"installation_row_id" text PRIMARY KEY NOT NULL,
	"key_version" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"wrapped_data_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_github_repository_link" (
	"disconnected_at" timestamp,
	"html_url" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"installation_row_id" text NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"project_id" text NOT NULL,
	"repository_id" bigint NOT NULL,
	"stop_reason" text,
	"triage_state" text DEFAULT 'Pending' NOT NULL,
	CONSTRAINT "project_github_repository_link_stop_reason_check" CHECK ("project_github_repository_link"."stop_reason" is null or "project_github_repository_link"."stop_reason" in ('App uninstalled', 'Access revoked', 'Repository not found')),
	CONSTRAINT "project_github_repository_link_triage_state_check" CHECK ("project_github_repository_link"."triage_state" in ('Pending', 'Skipped'))
);
--> statement-breakpoint
CREATE TABLE "project_github_repository_link_name" (
	"link_id" text NOT NULL,
	"name" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"owner" text NOT NULL,
	CONSTRAINT "project_github_repository_link_name_pk" PRIMARY KEY("link_id","observed_at")
);
--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD CONSTRAINT "project_github_external_record_link_id_project_github_repository_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."project_github_repository_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD CONSTRAINT "project_github_external_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_installation" ADD CONSTRAINT "project_github_installation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_installation_credential" ADD CONSTRAINT "project_github_installation_credential_installation_row_id_project_github_installation_id_fk" FOREIGN KEY ("installation_row_id") REFERENCES "public"."project_github_installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD CONSTRAINT "project_github_repository_link_installation_row_id_project_github_installation_id_fk" FOREIGN KEY ("installation_row_id") REFERENCES "public"."project_github_installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD CONSTRAINT "project_github_repository_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_repository_link_name" ADD CONSTRAINT "project_github_repository_link_name_link_id_project_github_repository_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."project_github_repository_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_external_record_source_idx" ON "project_github_external_record" USING btree ("link_id","kind","github_id");--> statement-breakpoint
CREATE INDEX "project_github_external_record_project_idx" ON "project_github_external_record" USING btree ("project_id","source_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_installation_project_installation_idx" ON "project_github_installation" USING btree ("project_id","installation_id");--> statement-breakpoint
CREATE INDEX "project_github_installation_installation_idx" ON "project_github_installation" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_repository_link_project_repository_idx" ON "project_github_repository_link" USING btree ("project_id","repository_id");