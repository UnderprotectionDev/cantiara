import type { PrismaClient } from "@cantiara/db";

export interface SeedContext {
	actorId: string;
	dryRun: boolean;
	prisma: PrismaClient;
	workspaceId: string;
}

export function idempotencyKey(prefix: string, key: string): string {
	return `seed:${prefix}:${key}`;
}
