import { env } from "@cantiara/env/server";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

import type { PrismaClient } from "../prisma/generated/client";
import {
	clientStampIsCurrent,
	loadGeneratedPrismaClient,
	readGeneratedClientStamp,
} from "./generated-prisma-client";

export { Prisma, PrismaClient } from "../prisma/generated/client";

// Local development: route the Neon serverless driver's WebSocket transport to a
// local proxy (see scripts/neon-local-proxy.ts) that tunnels to a local Postgres
// instance. This block is inert unless NEON_LOCAL=true, so hosted Neon usage is
// unchanged in production.
if (process.env.NEON_LOCAL === "true") {
	const proxy = process.env.NEON_LOCAL_PROXY ?? "127.0.0.1:5433";
	neonConfig.useSecureWebSocket = false;
	neonConfig.pipelineConnect = false;
	neonConfig.wsProxy = () => `${proxy}/v1`;
}

export function createPrismaClient() {
	const Client = loadGeneratedPrismaClient();
	if (process.env.NEON_LOCAL === "true") {
		return new Client({
			adapter: new PrismaNeon({
				connectionString: env.DATABASE_URL,
			}),
		});
	}
	// Long-running bun --hot cannot keep a PrismaNeon WebSocket alive.
	// Hosted Neon and local TCP use the PrismaPg adapter (Prisma ORM
	// PostgreSQL driver-adapter docs: PrismaPg({ connectionString })).
	return new Client({
		adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
	});
}

interface CachedPrisma {
	client: PrismaClient;
	stamp: string;
}

const globalForPrisma = globalThis as unknown as {
	cantiaraPrisma?: CachedPrisma;
};

function workModelFieldNames(client: PrismaClient): string[] {
	const runtime = client as { _runtimeDataModel?: unknown };
	if (!isRecord(runtime._runtimeDataModel)) {
		return [];
	}
	const { models } = runtime._runtimeDataModel;
	if (!(isRecord(models) && isRecord(models.Work))) {
		return [];
	}
	const { fields } = models.Work;
	if (!Array.isArray(fields)) {
		return [];
	}
	return fields.flatMap((field) => {
		if (isRecord(field) && typeof field.name === "string") {
			return [field.name];
		}
		return [];
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function clientHasCurrentDelegates(client: PrismaClient): boolean {
	return (
		typeof client.captureInboxItem?.findMany === "function" &&
		typeof client.projectSkeletonSelection?.findMany === "function" &&
		typeof client.captureExtensionLink?.findMany === "function" &&
		typeof client.captureStagingObject?.findMany === "function" &&
		typeof client.work?.findMany === "function" &&
		typeof client.work?.create === "function" &&
		typeof client.workLifecycleEvent?.findMany === "function" &&
		typeof client.workRelation?.findMany === "function" &&
		typeof client.workMergeEvent?.findFirst === "function" &&
		typeof client.workMergeEvent?.create === "function"
	);
}

function clientHasCurrentWorkModel(client: PrismaClient): boolean {
	const fields = workModelFieldNames(client);
	if (fields.length === 0) {
		return true;
	}
	return (
		fields.includes("originWork") &&
		fields.includes("originWorkId") &&
		fields.includes("retiredIntoId")
	);
}

function cachedClient(diskStamp: string): PrismaClient | undefined {
	const cached = globalForPrisma.cantiaraPrisma;
	if (!(cached && clientStampIsCurrent(cached.stamp, diskStamp))) {
		return;
	}
	if (!clientHasCurrentDelegates(cached.client)) {
		return;
	}
	if (!clientHasCurrentWorkModel(cached.client)) {
		return;
	}
	return cached.client;
}

function dropCachedPrisma() {
	const cached = globalForPrisma.cantiaraPrisma;
	if (cached) {
		cached.client.$disconnect().catch(() => undefined);
	}
	globalForPrisma.cantiaraPrisma = undefined;
}

let productionPrisma: PrismaClient | undefined;

export function getPrismaClient() {
	const diskStamp = readGeneratedClientStamp();
	if (process.env.NODE_ENV === "production") {
		productionPrisma ??= createPrismaClient();
		if (!clientHasCurrentDelegates(productionPrisma)) {
			throw new Error(
				"Prisma client is missing current models; restart the API after prisma generate"
			);
		}
		return productionPrisma;
	}
	const reused = cachedClient(diskStamp);
	if (reused) {
		return reused;
	}
	dropCachedPrisma();
	const client = createPrismaClient();
	if (!clientHasCurrentDelegates(client)) {
		client.$disconnect().catch(() => undefined);
		throw new Error(
			"Prisma client is missing current models; restart the API after prisma generate"
		);
	}
	globalForPrisma.cantiaraPrisma = { client, stamp: diskStamp };
	return client;
}
