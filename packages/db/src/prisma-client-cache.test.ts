import { describe, expect, it } from "bun:test";

import { getPrismaClient, resetPrismaClientCache } from "./index";

interface CachedPrismaSlot {
	cantiaraPrisma?: { stamp: string };
}

describe("Prisma client cache", () => {
	it("keeps the previous pool usable when a stale cached client is replaced", async () => {
		resetPrismaClientCache();
		const first = getPrismaClient();
		await first.$queryRaw`SELECT 1`;

		let disconnectCalled = false;
		const originalDisconnect = first.$disconnect.bind(first);
		first.$disconnect = () => {
			disconnectCalled = true;
			return originalDisconnect();
		};

		const slot = globalThis as CachedPrismaSlot;
		expect(slot.cantiaraPrisma).toBeDefined();
		slot.cantiaraPrisma = {
			...slot.cantiaraPrisma,
			stamp: "stale",
		};

		const second = getPrismaClient();
		expect(second).not.toBe(first);
		expect(disconnectCalled).toBe(false);
		await first.$queryRaw`SELECT 1`;
		await second.$queryRaw`SELECT 1`;
	});
});
