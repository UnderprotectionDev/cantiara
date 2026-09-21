CREATE OR REPLACE FUNCTION "create_workspace_for_github_account"()
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
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_trigger
		WHERE tgname = 'account_create_github_workspace'
			AND tgrelid = 'public.account'::regclass
	) THEN
		CREATE TRIGGER "account_create_github_workspace"
		AFTER INSERT ON "account"
		FOR EACH ROW
		EXECUTE FUNCTION "create_workspace_for_github_account"();
	END IF;
END;
$$;
