import { describe, expect, it } from "bun:test";

import {
	createEnsureGeneratedPrismaClient,
	fingerprintPrismaSchemaSources,
	generatedClientMatchesSchema,
} from "./ensure-generated-prisma-client";

describe("Prisma schema fingerprint", () => {
	it("changes when a schema source changes and ignores file order", () => {
		const first = fingerprintPrismaSchemaSources([
			{ contents: "model Work { id String }", path: "work.prisma" },
			{ contents: "model Tag { id String }", path: "tag.prisma" },
		]);
		const reordered = fingerprintPrismaSchemaSources([
			{ contents: "model Tag { id String }", path: "tag.prisma" },
			{ contents: "model Work { id String }", path: "work.prisma" },
		]);
		const changed = fingerprintPrismaSchemaSources([
			{
				contents: "model Work { id String title String }",
				path: "work.prisma",
			},
			{ contents: "model Tag { id String }", path: "tag.prisma" },
		]);
		expect(first).toBe(reordered);
		expect(changed).not.toBe(first);
	});

	it("treats a missing generate stamp as stale", () => {
		expect(generatedClientMatchesSchema("abc", undefined)).toBe(false);
		expect(generatedClientMatchesSchema("abc", "abc")).toBe(true);
		expect(generatedClientMatchesSchema("abc", "def")).toBe(false);
	});
});

describe("ensure generated Prisma client", () => {
	it("runs prisma generate when the schema fingerprint does not match the stamp", () => {
		let generated = false;
		let stamp: string | undefined = "old";
		const ensure = createEnsureGeneratedPrismaClient({
			forget: () => undefined,
			generate: () => {
				generated = true;
			},
			nodeEnv: () => "development",
			readStamp: () => stamp,
			schemaFingerprint: () => "new",
			writeStamp: (value) => {
				stamp = value;
			},
		});
		ensure();
		expect(generated).toBe(true);
		expect(stamp).toBe("new");
	});

	it("does not generate when the stamp already matches the schema", () => {
		let generated = false;
		const ensure = createEnsureGeneratedPrismaClient({
			forget: () => undefined,
			generate: () => {
				generated = true;
			},
			nodeEnv: () => "development",
			readStamp: () => "same",
			schemaFingerprint: () => "same",
			writeStamp: () => undefined,
		});
		ensure();
		expect(generated).toBe(false);
	});

	it("does not generate in production", () => {
		let generated = false;
		const ensure = createEnsureGeneratedPrismaClient({
			forget: () => undefined,
			generate: () => {
				generated = true;
			},
			nodeEnv: () => "production",
			readStamp: () => undefined,
			schemaFingerprint: () => "new",
			writeStamp: () => undefined,
		});
		ensure();
		expect(generated).toBe(false);
	});
});
