import type { PrismaClient } from "@cantiara/db";
import type { AuditLog, SessionRevokedEvent } from "./session-events";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

export function createPrismaAuditLog(prisma: PrismaClient): AuditLog {
	return {
		async append(event) {
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
		},
		async list() {
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
		},
	};
}
