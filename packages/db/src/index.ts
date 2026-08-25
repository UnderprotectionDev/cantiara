import { env } from "@cantiara/env/server";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../prisma/generated/client";

export { PrismaClient } from "../prisma/generated/client";

// Local development: route the Neon serverless driver's WebSocket transport to a
// local proxy (see scripts/neon-local-proxy.ts) that tunnels to a local Postgres
// instance. This block is inert unless NEON_LOCAL=true, so hosted Neon usage is
// unchanged in production.
if (process.env.NEON_LOCAL === "true") {
	const proxy = process.env.NEON_LOCAL_PROXY ?? "127.0.0.1:5433";
	neonConfig.useSecureWebSocket = false;
	neonConfig.pipelineConnect = false;
	neonConfig.wsProxy = () => `${proxy}/v1`;
} else {
	// Long-running bun --hot / Hono processes keep a PrismaNeon WebSocket open.
	// When that socket dies, every session lookup hangs ~15s then throws
	// Better Auth's "Failed to get session". HTTP fetch avoids that stale socket.
	neonConfig.poolQueryViaFetch = true;
}

export function createPrismaClient() {
	const adapter = new PrismaNeon({
		connectionString: env.DATABASE_URL,
	});

	return new PrismaClient({ adapter });
}

let defaultPrisma: PrismaClient | undefined;

export function getPrismaClient() {
	defaultPrisma ??= createPrismaClient();
	return defaultPrisma;
}
