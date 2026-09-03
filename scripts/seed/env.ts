import { existsSync } from "node:fs";

import { config } from "dotenv";

import { isLoopbackDatabaseUrl } from "../../packages/db/src/local-test-database-url.ts";

const ENV_FILES = [".env", "apps/server/.env"] as const;

for (const path of ENV_FILES) {
	if (existsSync(path)) {
		config({ override: false, path });
	}
}

const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl && !isLoopbackDatabaseUrl(databaseUrl)) {
	delete process.env.NEON_LOCAL;
	delete process.env.NEON_LOCAL_PROXY;
}

process.env.NODE_ENV ??= "development";
process.env.SKIP_ENV_VALIDATION ??= "true";
