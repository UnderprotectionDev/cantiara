CREATE TABLE "mutation_history" (
	"id" text PRIMARY KEY NOT NULL,
	"target_id" text NOT NULL,
	"revision" integer NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"authorizing_user_id" text,
	"origin_kind" text NOT NULL,
	"client_idempotency_key" text,
	"source_id" text,
	"delivery_id" text,
	"payload_fingerprint" text NOT NULL,
	"previous_value" jsonb NOT NULL,
	"next_value" jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	CONSTRAINT "mutation_history_actor_type_check" CHECK ("mutation_history"."actor_type" in ('User', 'System automation', 'GitHub', 'Authorized integration')),
	CONSTRAINT "mutation_history_origin_kind_check" CHECK ("mutation_history"."origin_kind" in ('human', 'source'))
);
--> statement-breakpoint
CREATE TABLE "mutation_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"target_id" text NOT NULL,
	"idempotency_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"authorizing_user_id" text,
	"origin_kind" text NOT NULL,
	"client_idempotency_key" text,
	"source_id" text,
	"delivery_id" text,
	"expected_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"previous_value" jsonb NOT NULL,
	"next_value" jsonb NOT NULL,
	"committed_at" timestamp NOT NULL,
	CONSTRAINT "mutation_receipt_actor_type_check" CHECK ("mutation_receipt"."actor_type" in ('User', 'System automation', 'GitHub', 'Authorized integration')),
	CONSTRAINT "mutation_receipt_origin_kind_check" CHECK ("mutation_receipt"."origin_kind" in ('human', 'source'))
);
--> statement-breakpoint
CREATE TABLE "mutation_target" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mutation_history_target_revision_idx" ON "mutation_history" USING btree ("target_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "mutation_receipt_idempotency_uidx" ON "mutation_receipt" USING btree ("idempotency_scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "mutation_receipt_target_idx" ON "mutation_receipt" USING btree ("target_id");
