-- Rebuild the append-only security log when migration metadata survived without
-- the table itself. Every statement is safe to rerun during drift recovery.
CREATE TABLE IF NOT EXISTS "security_event" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"actor_alias" text NOT NULL,
	"target_session_alias" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_event_occurredAt_idx"
	ON "security_event" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_event_targetSessionAlias_type_idx"
	ON "security_event" USING btree ("target_session_alias", "type");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reject_security_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'security_event is append-only';
	RETURN NULL;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_trigger
		WHERE tgname = 'security_event_reject_update_delete'
			AND tgrelid = 'security_event'::regclass
	) THEN
		EXECUTE 'CREATE TRIGGER "security_event_reject_update_delete"
			BEFORE UPDATE OR DELETE ON "security_event"
			FOR EACH ROW
			EXECUTE FUNCTION "reject_security_event_mutation"()';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_trigger
		WHERE tgname = 'security_event_reject_truncate'
			AND tgrelid = 'security_event'::regclass
	) THEN
		EXECUTE 'CREATE TRIGGER "security_event_reject_truncate"
			BEFORE TRUNCATE ON "security_event"
			FOR EACH STATEMENT
			EXECUTE FUNCTION "reject_security_event_mutation"()';
	END IF;
END;
$$;
