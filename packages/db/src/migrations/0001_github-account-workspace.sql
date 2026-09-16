CREATE FUNCTION "create_workspace_for_github_account"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."provider_id" = 'github' THEN
		INSERT INTO "workspace" ("id", "owner_account_id")
		VALUES (gen_random_uuid()::text, NEW."user_id")
		ON CONFLICT ("owner_account_id") DO NOTHING;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "account_create_github_workspace"
AFTER INSERT ON "account"
FOR EACH ROW
EXECUTE FUNCTION "create_workspace_for_github_account"();
