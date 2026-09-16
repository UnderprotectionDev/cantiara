import type { Database } from "@cantiara/db";
import { auditRecord, session } from "@cantiara/db/schema/auth";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, asc, eq, lt } from "drizzle-orm";

import {
  createAccountSessionAccess,
  type ProductSession,
  type SessionRevocationAuditRecord,
  type SessionRevokedSecurityEvent,
} from "./session-access";

type ProductSessionRecord = Omit<typeof session.$inferSelect, "token">;

const productSessionColumns = {
  createdAt: true,
  expiresAt: true,
  id: true,
  ipAddress: true,
  updatedAt: true,
  userAgent: true,
  userId: true,
} as const;

function toProductSession(record: ProductSessionRecord): ProductSession {
  return {
    accountId: record.userId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    id: record.id,
    lastActivityAt: record.updatedAt,
    userAgent: record.userAgent,
  };
}

export function createDatabaseAccountSessionAccess(
  database: Database,
  securityEventDatabase: SecurityEventDatabase,
  options: {
    onGitHubLoginOAuthRevoked?: () => void;
  } = {},
) {
  return createAccountSessionAccess({
    auditRecords: {
      async append(record: SessionRevocationAuditRecord) {
        await database
          .insert(auditRecord)
          .values({
            ...record,
            occurredAt: new Date(record.occurredAt),
          })
          .onConflictDoNothing({ target: auditRecord.id });
      },
      async pruneBefore(cutoff) {
        await database
          .delete(auditRecord)
          .where(lt(auditRecord.occurredAt, cutoff));
      },
    },
    onGitHubLoginOAuthRevoked: options.onGitHubLoginOAuthRevoked,
    securityEvents: {
      async appendMany(events: SessionRevokedSecurityEvent[]) {
        if (events.length === 0) {
          return;
        }
        await securityEventDatabase.transaction(async (transaction) => {
          await transaction.insert(securityEvent).values(
            events.map((event) => ({
              ...event,
              occurredAt: new Date(event.occurredAt),
            })),
          );
        });
      },
      async isSessionRevoked(targetSessionAlias: string) {
        const [event] = await securityEventDatabase
          .select({ id: securityEvent.id })
          .from(securityEvent)
          .where(
            and(
              eq(securityEvent.targetSessionAlias, targetSessionAlias),
              eq(securityEvent.type, "session.revoked"),
            ),
          )
          .limit(1);
        return Boolean(event);
      },
      async listSessionRevocations() {
        const events = await securityEventDatabase
          .select()
          .from(securityEvent)
          .where(eq(securityEvent.type, "session.revoked"))
          .orderBy(asc(securityEvent.occurredAt));
        return events.map((event) => {
          if (event.version !== 1) {
            throw new Error(
              `Unsupported session revoke event version: ${event.version}`,
            );
          }
          return {
            actorAlias: event.actorAlias,
            id: event.id,
            occurredAt: event.occurredAt.toISOString(),
            targetSessionAlias: event.targetSessionAlias,
            type: "session.revoked" as const,
            version: 1 as const,
          };
        });
      },
    },
    sessions: {
      async find(sessionId) {
        const record = await database.query.session.findFirst({
          columns: productSessionColumns,
          where: eq(session.id, sessionId),
        });
        return record ? toProductSession(record) : null;
      },
      async list(accountId) {
        const records = await database.query.session.findMany({
          columns: productSessionColumns,
          orderBy: [asc(session.updatedAt)],
          where: eq(session.userId, accountId),
        });
        return records.map(toProductSession);
      },
      async revoke(accountId, sessionId) {
        await database
          .delete(session)
          .where(and(eq(session.userId, accountId), eq(session.id, sessionId)));
      },
      async touch(accountId, sessionId, lastActivityAt) {
        await database
          .update(session)
          .set({ updatedAt: lastActivityAt })
          .where(and(eq(session.userId, accountId), eq(session.id, sessionId)));
      },
    },
  });
}
