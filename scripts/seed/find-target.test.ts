import { describe, expect, it } from "bun:test";

import { assertHostedSeedAllowed, isLocalDatabaseUrl } from "./find-target";

const HOSTED_SEED_CONFIRM = /SEED_CONFIRM=hosted/;

describe("seed find-target", () => {
	it("detects local database URLs", () => {
		expect(
			isLocalDatabaseUrl(
				"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara"
			)
		).toBe(true);
		expect(
			isLocalDatabaseUrl("postgresql://user:pass@localhost:5432/cantiara")
		).toBe(true);
		expect(
			isLocalDatabaseUrl(
				"postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require"
			)
		).toBe(false);
	});

	it("refuses hosted seed without SEED_CONFIRM even in development", () => {
		const previousConfirm = process.env.SEED_CONFIRM;
		const previousEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";
		delete process.env.SEED_CONFIRM;
		expect(() =>
			assertHostedSeedAllowed(
				"postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/neondb"
			)
		).toThrow(HOSTED_SEED_CONFIRM);
		if (previousConfirm === undefined) {
			delete process.env.SEED_CONFIRM;
		} else {
			process.env.SEED_CONFIRM = previousConfirm;
		}
		process.env.NODE_ENV = previousEnv;
	});
});
