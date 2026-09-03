import { describe, expect, it } from "bun:test";

import {
	assertDatabaseUrlAllowsDbPush,
	isLoopbackDatabaseUrl,
	isTestProcess,
	localTestDatabaseUrl,
	prismaAdapterConnectionString,
} from "./local-test-database-url";

const LOCAL = "postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";
const HOSTED =
	"postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const HOSTED_DB_PUSH = /db push against a hosted database/;

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
		expect(
			isLoopbackDatabaseUrl(
				"postgresql://localhost:pass@ep-example.eu-central-1.aws.neon.tech/neondb"
			)
		).toBe(false);
	});

	it("treats bun test and Vitest as test processes", () => {
		expect(isTestProcess(["/home/ubuntu/.bun/bin/bun"], undefined)).toBe(false);
		expect(
			isTestProcess(
				["/home/ubuntu/.bun/bin/bun", "packages/db/src/foo.test.ts"],
				undefined
			)
		).toBe(true);
		expect(isTestProcess(["node", "vitest"], "true")).toBe(true);
	});

	it("points the Prisma adapter at loopback during tests", () => {
		expect(prismaAdapterConnectionString(HOSTED, true)).toBe(LOCAL);
		expect(prismaAdapterConnectionString(HOSTED, false)).toBe(HOSTED);
		expect(prismaAdapterConnectionString(LOCAL, false)).toBe(LOCAL);
	});

	it("refuses db push against hosted Neon", () => {
		expect(() => assertDatabaseUrlAllowsDbPush(LOCAL)).not.toThrow();
		expect(() => assertDatabaseUrlAllowsDbPush("")).not.toThrow();
		expect(() => assertDatabaseUrlAllowsDbPush(HOSTED)).toThrow(HOSTED_DB_PUSH);
	});
});
