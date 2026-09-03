import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPrismaAuditLog } from "./audit-log";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

const DATABASE_URL = localTestDatabaseUrl();

describe("Prisma Denetim kaydı", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.auditEvent.deleteMany();
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("appends to the migrated Denetim kaydı table", async () => {
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
