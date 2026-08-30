import { describe, expect, it } from "bun:test";

import { getPrismaClient, resetPrismaClientCache } from "./index";
import { prismaClientHasCurrentDelegates } from "./prisma-client-delegates";

const CURRENT_MODELS_MESSAGE =
	"Prisma client is missing current models; restart the API after prisma generate";

describe("Prisma current models gate", () => {
	it("lets getPrismaClient load a generated client that includes RecordAction", () => {
		resetPrismaClientCache();
		try {
			const client = getPrismaClient();
			expect(typeof client.recordAction.findMany).toBe("function");
			expect(typeof client.recordAction.create).toBe("function");
			expect(prismaClientHasCurrentDelegates(client)).toBe(true);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(message).not.toBe(CURRENT_MODELS_MESSAGE);
			throw error;
		}
	});
});
