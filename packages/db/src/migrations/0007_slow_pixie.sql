CREATE TABLE "mutation_staging" (
	"id" text PRIMARY KEY NOT NULL,
	"target_id" text NOT NULL,
	"idempotency_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb,
	"payload_fingerprint" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"authorizing_user_id" text,
	"origin_kind" text NOT NULL,
	"client_idempotency_key" text,
	"source_id" text,
	"delivery_id" text,
	"expected_revision" integer NOT NULL,
	"receipt_id" text NOT NULL,
	"history_id" text NOT NULL,
	"status" text DEFAULT 'staged' NOT NULL,
	"rollback_reason" text,
	"rollback_current_revision" integer,
	"rollback_current_value" jsonb,
	"staged_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "mutation_staging_actor_type_check" CHECK ("mutation_staging"."actor_type" in ('User', 'System automation', 'GitHub', 'Authorized integration')),
	CONSTRAINT "mutation_staging_origin_kind_check" CHECK ("mutation_staging"."origin_kind" in ('human', 'source')),
	CONSTRAINT "mutation_staging_status_check" CHECK ("mutation_staging"."status" in ('staged', 'finalizing', 'committed', 'rolled-back'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mutation_staging_idempotency_uidx" ON "mutation_staging" USING btree ("idempotency_scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "mutation_staging_expiry_idx" ON "mutation_staging" USING btree ("status","expires_at");