import { env } from "@cantiara/env/server";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

import type { PrismaClient } from "../prisma/generated/client";
import {
	ensureGeneratedPrismaClient,
	forceRegeneratePrismaClient,
} from "./ensure-generated-prisma-client";
import {
	clientStampIsCurrent,
	forgetGeneratedPrismaClientCache,
	loadGeneratedPrismaClient,
	readGeneratedClientStamp,
} from "./generated-prisma-client";
import {
	prismaClientHasCurrentDelegates,
	prismaClientHasCurrentExternalExecutionHandoffModel,
	prismaClientHasCurrentFileAttachmentVersionModel,
	prismaClientHasCurrentProjectModel,
	prismaClientHasCurrentTypedRelationModel,
	prismaClientHasCurrentWorkspaceModel,
} from "./prisma-client-delegates";

export { Prisma, PrismaClient } from "../prisma/generated/client";
export { ensureGeneratedPrismaClient } from "./ensure-generated-prisma-client";
export { readGeneratedClientStamp } from "./generated-prisma-client";
export {
	prismaClientHasCurrentDelegates,
	prismaClientHasCurrentExternalExecutionHandoffModel,
	prismaClientHasCurrentFileAttachmentVersionModel,
	prismaClientHasCurrentProjectModel,
	prismaClientHasCurrentTypedRelationModel,
	prismaClientHasCurrentWorkspaceModel,
	workspaceOverviewLayoutSelect,
} from "./prisma-client-delegates";
export {
	readWorkspaceOverviewLayout,
	writeWorkspaceOverviewLayout,
} from "./workspace-overview-layout";

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

function clientHasCurrentWorkModel(client: PrismaClient): boolean {
	const fields = workModelFieldNames(client);
	if (fields.length === 0) {
		return true;
	}
	return (
		fields.includes("originWork") &&
		fields.includes("originWorkId") &&
		fields.includes("retiredIntoId") &&
		fields.includes("includedInFeatureId") &&
		fields.includes("externalExecutionHandoffs") &&
		fields.includes("reappearDate") &&
		fields.includes("targetDate") &&
		fields.includes("plannedStart") &&
		fields.includes("horizon") &&
		fields.includes("notNowReviewLaterIds") &&
		fields.includes("notNowTrails")
	);
}

function cachedClient(diskStamp: string): PrismaClient | undefined {
	const cached = globalForPrisma.cantiaraPrisma;
	if (!(cached && clientStampIsCurrent(cached.stamp, diskStamp))) {
		return;
	}
	if (!prismaClientHasCurrentDelegates(cached.client)) {
		return;
	}
	if (!clientHasCurrentWorkModel(cached.client)) {
		return;
	}
	if (!prismaClientHasCurrentFileAttachmentVersionModel(cached.client)) {
		return;
	}
	if (!prismaClientHasCurrentProjectModel(cached.client)) {
		return;
	}
	if (!prismaClientHasCurrentWorkspaceModel(cached.client)) {
		return;
	}
	if (!prismaClientHasCurrentTypedRelationModel(cached.client)) {
		return;
	}
	if (!prismaClientHasCurrentExternalExecutionHandoffModel(cached.client)) {
		return;
	}
	return cached.client;
}

function takeCachedPrisma(): PrismaClient | undefined {
	const cached = globalForPrisma.cantiaraPrisma;
	globalForPrisma.cantiaraPrisma = undefined;
	return cached?.client;
}

let productionPrisma: PrismaClient | undefined;

export function forgetPrismaClientCache() {
	takeCachedPrisma();
	productionPrisma = undefined;
	forgetGeneratedPrismaClientCache();
}

export function resetPrismaClientCache() {
	const cached = takeCachedPrisma();
	cached?.$disconnect().catch(() => undefined);
	if (productionPrisma) {
		productionPrisma.$disconnect().catch(() => undefined);
		productionPrisma = undefined;
	}
	forgetGeneratedPrismaClientCache();
}

export function getPrismaClient() {
	if (process.env.NODE_ENV !== "production") {
		ensureGeneratedPrismaClient();
	}
	const diskStamp = readGeneratedClientStamp();
	if (process.env.NODE_ENV === "production") {
		productionPrisma ??= createPrismaClient();
		if (!prismaClientHasRequiredModels(productionPrisma)) {
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
	// Leave the previous client's pool running. In-flight RPC still holds that
	// instance; $disconnect() ends pg.Pool and surfaces as "Cannot use a pool
	// after calling end on the pool". Tests call resetPrismaClientCache().
	takeCachedPrisma();
	const client = loadCurrentPrismaClient();
	globalForPrisma.cantiaraPrisma = {
		client,
		stamp: readGeneratedClientStamp(),
	};
	return client;
}

function prismaClientHasRequiredModels(client: PrismaClient): boolean {
	return (
		prismaClientHasCurrentDelegates(client) &&
		prismaClientHasCurrentTypedRelationModel(client) &&
		prismaClientHasCurrentExternalExecutionHandoffModel(client)
	);
}

function loadCurrentPrismaClient(): PrismaClient {
	const client = createPrismaClient();
	if (prismaClientHasRequiredModels(client)) {
		return client;
	}
	client.$disconnect().catch(() => undefined);
	if (process.env.NODE_ENV !== "production") {
		forceRegeneratePrismaClient();
		const regenerated = createPrismaClient();
		if (prismaClientHasRequiredModels(regenerated)) {
			return regenerated;
		}
		regenerated.$disconnect().catch(() => undefined);
	}
	throw new Error(
		"Prisma client is missing current models; restart the API after prisma generate"
	);
}
