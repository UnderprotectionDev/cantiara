import { describe, expect, it } from "bun:test";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
	clientStampIsCurrent,
	forgetGeneratedPrismaClientCache,
	loadGeneratedPrismaClient,
	readGeneratedClientStamp,
	stampFromFileStats,
} from "./generated-prisma-client";

describe("generated Prisma client stamp", () => {
	it("changes when the generated class file size or mtime changes", () => {
		expect(stampFromFileStats(10, 20)).toBe("10:20");
		expect(clientStampIsCurrent("10:20", "10:20")).toBe(true);
		expect(clientStampIsCurrent("10:20", "11:20")).toBe(false);
		expect(clientStampIsCurrent(undefined, "10:20")).toBe(false);
	});

	it("reads a stable stamp from the generated class on disk", () => {
		const first = readGeneratedClientStamp();
		const second = readGeneratedClientStamp();
		expect(first).toBe(second);
		const classPath = fileURLToPath(
			new URL("../prisma/generated/internal/class.ts", import.meta.url)
		);
		const stats = statSync(classPath);
		expect(first).toBe(stampFromFileStats(stats.size, stats.mtimeMs));
	});

	it("loads a new PrismaClient class after the generate cache is dropped", () => {
		const first = loadGeneratedPrismaClient();
		forgetGeneratedPrismaClientCache();
		const second = loadGeneratedPrismaClient();
		expect(typeof first).toBe("function");
		expect(typeof second).toBe("function");
		expect(first).not.toBe(second);
	});
});
