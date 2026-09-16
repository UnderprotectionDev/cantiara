CREATE TABLE "audit_record" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"actor_alias" text NOT NULL,
	"target_session_alias" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_record_occurredAt_idx" ON "audit_record" USING btree ("occurred_at");