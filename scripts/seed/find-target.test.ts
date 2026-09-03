import { describe, expect, it } from "bun:test";

import { isLocalDatabaseUrl } from "./find-target";

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
});
