import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { forgetGeneratedPrismaClientCache } from "./generated-prisma-client";

const schemaDirUrl = new URL("../prisma/schema/", import.meta.url);
const fingerprintUrl = new URL(
	"../prisma/generated/schema.fingerprint",
	import.meta.url
);
const packageRootUrl = new URL("..", import.meta.url);

export interface PrismaSchemaSource {
	contents: string;
	path: string;
}

export interface EnsureGeneratedPrismaClientDeps {
	forget: () => void;
	generate: () => void;
	nodeEnv: () => string | undefined;
	readStamp: () => string | undefined;
	schemaFingerprint: () => string;
	writeStamp: (value: string) => void;
}

export function fingerprintPrismaSchemaSources(
	files: PrismaSchemaSource[]
): string {
	const hash = createHash("sha256");
	const ordered = [...files].sort((left, right) =>
		left.path.localeCompare(right.path)
	);
	for (const file of ordered) {
		hash.update(file.path);
		hash.update("\0");
		hash.update(file.contents);
		hash.update("\0");
	}
	return hash.digest("hex");
}

export function generatedClientMatchesSchema(
	schemaFingerprint: string,
	stamp: string | undefined
): boolean {
	return stamp === schemaFingerprint;
}

export function createEnsureGeneratedPrismaClient(
	deps: EnsureGeneratedPrismaClientDeps
): () => void {
	return () => {
		if (deps.nodeEnv() === "production") {
			return;
		}
		const schemaFingerprint = deps.schemaFingerprint();
		if (generatedClientMatchesSchema(schemaFingerprint, deps.readStamp())) {
			return;
		}
		deps.generate();
		deps.writeStamp(schemaFingerprint);
		deps.forget();
	};
}

function listPrismaSchemaSources(
	directory = schemaDirectory()
): PrismaSchemaSource[] {
	return collectPrismaFiles(directory, "").map((relative) => ({
		contents: readFileSync(join(directory, relative), "utf8"),
		path: relative,
	}));
}

export function readPrismaSchemaFingerprint(): string {
	return fingerprintPrismaSchemaSources(listPrismaSchemaSources());
}

export function runPrismaGenerate(): void {
	const result = spawnSync(
		"bunx",
		["--bun", "prisma", "generate", "--no-hints"],
		{
			cwd: fileURLToPath(packageRootUrl),
			encoding: "utf8",
		}
	);
	if (result.status !== 0) {
		const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
		throw new Error(
			output.length > 0
				? output
				: "prisma generate failed while refreshing the client"
		);
	}
}

export const ensureGeneratedPrismaClient = createEnsureGeneratedPrismaClient({
	forget: forgetGeneratedPrismaClientCache,
	generate: runPrismaGenerate,
	nodeEnv: () => process.env.NODE_ENV,
	readStamp: readGeneratedSchemaStamp,
	schemaFingerprint: readPrismaSchemaFingerprint,
	writeStamp: writeGeneratedSchemaStamp,
});

export function forceRegeneratePrismaClient(): void {
	if (process.env.NODE_ENV === "production") {
		return;
	}
	runPrismaGenerate();
	writeGeneratedSchemaStamp(readPrismaSchemaFingerprint());
	forgetGeneratedPrismaClientCache();
}

function schemaDirectory(): string {
	return fileURLToPath(schemaDirUrl);
}

function collectPrismaFiles(directory: string, prefix: string): string[] {
	const entries = readdirSync(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const relative = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...collectPrismaFiles(join(directory, entry.name), relative));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".prisma")) {
			files.push(relative);
		}
	}
	return files;
}

function readGeneratedSchemaStamp(): string | undefined {
	const path = fileURLToPath(fingerprintUrl);
	if (!existsSync(path)) {
		return;
	}
	return readFileSync(path, "utf8").trim();
}

function writeGeneratedSchemaStamp(value: string): void {
	writeFileSync(fileURLToPath(fingerprintUrl), `${value}\n`, "utf8");
}
