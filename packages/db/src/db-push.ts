import { spawnSync } from "node:child_process";

import { assertDatabaseUrlAllowsDbPush } from "./local-test-database-url";

assertDatabaseUrlAllowsDbPush(process.env.DATABASE_URL ?? "");

const result = spawnSync(
	"bunx",
	["prisma", "db", "push", ...process.argv.slice(2)],
	{ stdio: "inherit" }
);
process.exit(result.status ?? 1);
