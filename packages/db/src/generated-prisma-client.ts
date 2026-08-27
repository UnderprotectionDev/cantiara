import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../prisma/generated/client";

const generatedDirUrl = new URL("../prisma/generated/", import.meta.url);
const generatedClientUrl = new URL(
	"../prisma/generated/client.ts",
	import.meta.url
);
const generatedClassUrl = new URL(
	"../prisma/generated/internal/class.ts",
	import.meta.url
);

const require = createRequire(import.meta.url);

export function stampFromFileStats(size: number, mtimeMs: number): string {
	return `${size}:${mtimeMs}`;
}

export function clientStampIsCurrent(
	boundStamp: string | undefined,
	diskStamp: string
): boolean {
	return boundStamp === diskStamp;
}

export function readGeneratedClientStamp(): string {
	const stats = statSync(fileURLToPath(generatedClassUrl));
	return stampFromFileStats(stats.size, stats.mtimeMs);
}

export function forgetGeneratedPrismaClientCache(): void {
	const { cache } = require;
	if (!cache) {
		return;
	}
	const generatedDir = fileURLToPath(generatedDirUrl);
	for (const key of Object.keys(cache)) {
		if (key.startsWith(generatedDir)) {
			delete cache[key];
		}
	}
}

export function loadGeneratedPrismaClient(): typeof PrismaClient {
	if (!process.versions.bun) {
		return PrismaClient;
	}
	forgetGeneratedPrismaClientCache();
	return require(fileURLToPath(generatedClientUrl))
		.PrismaClient as typeof PrismaClient;
}
