import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPrismaAuditLog } from "./audit-log";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

describe("Prisma Denetim kaydı", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeEach(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("creates the Denetim kaydı table when it is missing", async () => {
		await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "audit_event"`);
		const log = createPrismaAuditLog(prisma);
		await log.append({
			accountAlias: "a".repeat(64),
			actorAlias: "b".repeat(64),
			id: crypto.randomUUID(),
			occurredAt: new Date().toISOString(),
			sessionAlias: "c".repeat(64),
			type: SESSION_REVOKED_EVENT_TYPE,
		});
		expect(await log.list()).toHaveLength(1);
	});
});
