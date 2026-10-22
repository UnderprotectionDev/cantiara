CREATE TABLE "project_github_external_record_tombstone" (
	"deleted_at" timestamp NOT NULL,
	"github_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"link_id" text NOT NULL,
	"number" integer NOT NULL,
	"record_id" text NOT NULL,
	CONSTRAINT "project_github_external_record_tombstone_pk" PRIMARY KEY("link_id","kind","github_id")
);
--> statement-breakpoint
CREATE TABLE "project_github_link_history" (
	"at" timestamp NOT NULL,
	"detail" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"link_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_webhook_delivery" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"installation_id" bigint,
	"last_error" text,
	"payload_hash" text NOT NULL,
	"processed_at" timestamp,
	"received_at" timestamp NOT NULL,
	"result" text,
	"status" text DEFAULT 'received' NOT NULL,
	CONSTRAINT "github_webhook_delivery_status_check" CHECK ("github_webhook_delivery"."status" in ('received', 'processed', 'failed', 'dead-letter'))
);
--> statement-breakpoint
CREATE TABLE "github_webhook_payload" (
	"ciphertext" text NOT NULL,
	"delivery_id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"key_version" integer NOT NULL,
	"wrapped_data_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_webhook_secret" (
	"activated_at" timestamp NOT NULL,
	"ciphertext" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key_version" integer NOT NULL,
	"retired_at" timestamp,
	"wrapped_data_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "needs_reconcile" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "applied_from" text DEFAULT 'reconcile' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "origin_record_id" text;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "origin_deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD COLUMN "last_error_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD COLUMN "last_success_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD COLUMN "paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD COLUMN "rate_limited_until" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_repository_link" ADD COLUMN "sync_cursor" timestamp;--> statement-breakpoint
ALTER TABLE "project_github_external_record_tombstone" ADD CONSTRAINT "project_github_external_record_tombstone_link_id_project_github_repository_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."project_github_repository_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_link_history" ADD CONSTRAINT "project_github_link_history_link_id_project_github_repository_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."project_github_repository_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_webhook_payload" ADD CONSTRAINT "github_webhook_payload_delivery_id_github_webhook_delivery_delivery_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."github_webhook_delivery"("delivery_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_github_link_history_link_idx" ON "project_github_link_history" USING btree ("link_id","at");--> statement-breakpoint
CREATE INDEX "github_webhook_delivery_received_idx" ON "github_webhook_delivery" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "github_webhook_delivery_status_idx" ON "github_webhook_delivery" USING btree ("status");--> statement-breakpoint
CREATE INDEX "github_webhook_payload_expires_idx" ON "github_webhook_payload" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "project_github_external_record" ADD CONSTRAINT "project_github_external_record_applied_from_check" CHECK ("project_github_external_record"."applied_from" in ('reconcile', 'webhook'));