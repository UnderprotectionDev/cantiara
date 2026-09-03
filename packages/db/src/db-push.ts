import { spawnSync } from "node:child_process";
import path from "node:path";

import dotenv from "dotenv";

import { assertDatabaseUrlAllowsDbPush } from "./local-test-database-url";

dotenv.config({
	override: false,
	path: path.join(import.meta.dir, "../../apps/server/.env"),
});
assertDatabaseUrlAllowsDbPush(process.env.DATABASE_URL ?? "");

const result = spawnSync(
	"bunx",
	["prisma", "db", "push", ...process.argv.slice(2)],
	{ stdio: "inherit" }
);
process.exit(result.status ?? 1);
