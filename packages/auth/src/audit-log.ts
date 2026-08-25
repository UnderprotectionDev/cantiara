import type { PrismaClient } from "@cantiara/db";
import type { AuditLog, SessionRevokedEvent } from "./session-events";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS "audit_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorAlias" TEXT NOT NULL,
    "accountAlias" TEXT NOT NULL,
    "sessionAlias" TEXT,
    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
)
`;

const ENSURE_INDEX = `
CREATE INDEX IF NOT EXISTS "audit_event_accountAlias_occurredAt_idx"
ON "audit_event"("accountAlias", "occurredAt")
`;

export function createPrismaAuditLog(prisma: PrismaClient): AuditLog {
	let ready: Promise<void> | undefined;

	async function ensureTable() {
		ready ??= (async () => {
			await prisma.$executeRawUnsafe(ENSURE_TABLE);
			await prisma.$executeRawUnsafe(ENSURE_INDEX);
		})();
		await ready;
	}

	async function write(event: SessionRevokedEvent) {
		await prisma.auditEvent.create({
			data: {
				accountAlias: event.accountAlias,
				actorAlias: event.actorAlias,
				id: event.id,
				occurredAt: new Date(event.occurredAt),
				sessionAlias: event.sessionAlias,
				type: event.type,
			},
		});
	}

	async function read() {
		const rows = await prisma.auditEvent.findMany({
			orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
		});
		return rows.map(
			(row) =>
				({
					accountAlias: row.accountAlias,
					actorAlias: row.actorAlias,
					id: row.id,
					occurredAt: row.occurredAt.toISOString(),
					sessionAlias: row.sessionAlias ?? "",
					type: SESSION_REVOKED_EVENT_TYPE,
				}) satisfies SessionRevokedEvent
		);
	}

	return {
		async append(event) {
			try {
				await write(event);
			} catch (error) {
				if (!isMissingAuditEventTable(error)) {
					throw error;
				}
				ready = undefined;
				await ensureTable();
				await write(event);
			}
		},
		async list() {
			try {
				return await read();
			} catch (error) {
				if (!isMissingAuditEventTable(error)) {
					throw error;
				}
				ready = undefined;
				await ensureTable();
				return await read();
			}
		},
	};
}

function isMissingAuditEventTable(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "P2021"
	);
}
