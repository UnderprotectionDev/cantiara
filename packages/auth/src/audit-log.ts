import type { PrismaClient } from "@cantiara/db";
import type { AuditLog, SessionAuditEvent } from "./session-events";
import { isSessionAuditEventType } from "./session-events";

export function createPrismaAuditLog(prisma: PrismaClient): AuditLog {
	async function write(event: SessionAuditEvent) {
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

	async function read(): Promise<SessionAuditEvent[]> {
		const rows = await prisma.auditEvent.findMany({
			orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
		});
		return rows.flatMap((row) => {
			if (!isSessionAuditEventType(row.type)) {
				return [];
			}
			return [
				{
					accountAlias: row.accountAlias,
					actorAlias: row.actorAlias,
					id: row.id,
					occurredAt: row.occurredAt.toISOString(),
					sessionAlias: row.sessionAlias ?? "",
					type: row.type,
				},
			];
		});
	}

	return {
		append: write,
		list: read,
	};
}
