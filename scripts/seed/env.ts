import { existsSync } from "node:fs";

import { config } from "dotenv";

const LOCAL_DATABASE_PATTERN = /127\.0\.0\.1|localhost/;

const ENV_FILES = [".env", "apps/server/.env"] as const;

for (const path of ENV_FILES) {
	if (existsSync(path)) {
		config({ override: false, path });
	}
}

function isHostedDatabaseUrl(url: string): boolean {
	return url.length > 0 && !LOCAL_DATABASE_PATTERN.test(url);
}

const databaseUrl = process.env.DATABASE_URL ?? "";
if (isHostedDatabaseUrl(databaseUrl)) {
	delete process.env.NEON_LOCAL;
	delete process.env.NEON_LOCAL_PROXY;
}

process.env.NODE_ENV ??= "development";
process.env.SKIP_ENV_VALIDATION ??= "true";
