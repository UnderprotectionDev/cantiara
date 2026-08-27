import { env } from "@cantiara/env/server";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../prisma/generated/client";

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
	if (process.env.NEON_LOCAL === "true") {
		return new PrismaClient({
			adapter: new PrismaNeon({
				connectionString: env.DATABASE_URL,
			}),
		});
	}
	// Long-running bun --hot / Hono processes cannot keep a PrismaNeon
	// WebSocket alive. When that socket dies, Project writes hang ~16s then
	// throw "Connection terminated unexpectedly". TCP pg is the same adapter
	// Project Shell tests already use.
	return new PrismaClient({
		adapter: new PrismaPg(new Pool({ connectionString: env.DATABASE_URL })),
	});
}

let defaultPrisma: PrismaClient | undefined;

function clientHasCurrentDelegates(client: PrismaClient): boolean {
	return (
		typeof client.captureInboxItem?.findMany === "function" &&
		typeof client.projectSkeletonSelection?.findMany === "function" &&
		typeof client.captureExtensionLink?.findMany === "function" &&
		typeof client.captureStagingObject?.findMany === "function" &&
		typeof client.work?.findMany === "function"
	);
}

export function getPrismaClient() {
	if (
		defaultPrisma !== undefined &&
		!clientHasCurrentDelegates(defaultPrisma)
	) {
		defaultPrisma.$disconnect().catch(() => undefined);
		defaultPrisma = undefined;
	}
	defaultPrisma ??= createPrismaClient();
	if (!clientHasCurrentDelegates(defaultPrisma)) {
		defaultPrisma.$disconnect().catch(() => undefined);
		defaultPrisma = undefined;
		throw new Error(
			"Prisma client is missing current models; restart the API after prisma generate"
		);
	}
	return defaultPrisma;
}
