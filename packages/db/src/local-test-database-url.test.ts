import { describe, expect, it } from "bun:test";

import {
	isLoopbackDatabaseUrl,
	localTestDatabaseUrl,
} from "./local-test-database-url";

const LOCAL = "postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";
const HOSTED =
	"postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require";

describe("local test database URL", () => {
	it("ignores a hosted DATABASE_URL so tests cannot wipe Neon", () => {
		expect(localTestDatabaseUrl(HOSTED)).toBe(LOCAL);
		expect(localTestDatabaseUrl(undefined)).toBe(LOCAL);
		expect(localTestDatabaseUrl(LOCAL)).toBe(LOCAL);
		expect(
			localTestDatabaseUrl(
				"postgresql://cantiara:cantiara@localhost:5432/cantiara"
			)
		).toBe("postgresql://cantiara:cantiara@localhost:5432/cantiara");
		expect(isLoopbackDatabaseUrl(HOSTED)).toBe(false);
		expect(isLoopbackDatabaseUrl(LOCAL)).toBe(true);
	});
});
