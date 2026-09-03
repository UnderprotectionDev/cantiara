import "./env.ts";
import {
	createPrismaClient,
	type PrismaClient,
} from "../../packages/db/src/index.ts";

let client: PrismaClient | null = null;

export function getSeedPrismaClient(): PrismaClient {
	if (!client) {
		client = createPrismaClient();
	}
	return client;
}

export async function disconnectSeedPrismaClient(): Promise<void> {
	if (client) {
		await client.$disconnect();
		client = null;
	}
}
