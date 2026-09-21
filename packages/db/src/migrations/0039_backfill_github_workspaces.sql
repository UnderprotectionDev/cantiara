INSERT INTO "workspace" ("id", "owner_account_id")
SELECT gen_random_uuid()::text, github_accounts."user_id"
FROM (
	SELECT DISTINCT "user_id"
	FROM "account"
	WHERE "provider_id" = 'github'
) AS github_accounts
ON CONFLICT ("owner_account_id") DO NOTHING;
