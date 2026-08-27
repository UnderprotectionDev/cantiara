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
import { prismaClientHasCurrentDelegates } from "./prisma-client-delegates";

export { Prisma, PrismaClient } from "../prisma/generated/client";
export { prismaClientHasCurrentDelegates } from "./prisma-client-delegates";

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

function cachedClient(diskStamp: string): PrismaClient | undefined {
	const cached = globalForPrisma.cantiaraPrisma;
	if (!(cached && clientStampIsCurrent(cached.stamp, diskStamp))) {
		return;
	}
	if (!prismaClientHasCurrentDelegates(cached.client)) {
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
		if (!prismaClientHasCurrentDelegates(productionPrisma)) {
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
	if (!prismaClientHasCurrentDelegates(client)) {
		client.$disconnect().catch(() => undefined);
		throw new Error(
			"Prisma client is missing current models; restart the API after prisma generate"
		);
	}
	globalForPrisma.cantiaraPrisma = { client, stamp: diskStamp };
	return client;
}
