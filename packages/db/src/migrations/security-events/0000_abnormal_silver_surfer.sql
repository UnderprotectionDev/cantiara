CREATE TABLE "security_event" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"actor_alias" text NOT NULL,
	"target_session_alias" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "security_event_occurredAt_idx" ON "security_event" USING btree ("occurred_at");
