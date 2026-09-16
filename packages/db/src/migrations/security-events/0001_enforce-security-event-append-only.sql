CREATE FUNCTION "reject_security_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'security_event is append-only';
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "security_event_reject_update_delete"
BEFORE UPDATE OR DELETE ON "security_event"
FOR EACH ROW
EXECUTE FUNCTION "reject_security_event_mutation"();
--> statement-breakpoint
CREATE TRIGGER "security_event_reject_truncate"
BEFORE TRUNCATE ON "security_event"
FOR EACH STATEMENT
EXECUTE FUNCTION "reject_security_event_mutation"();
