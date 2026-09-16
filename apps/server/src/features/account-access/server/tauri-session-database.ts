import type { Database } from "@cantiara/db";
import { session, verification } from "@cantiara/db/schema/auth";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, eq, gt } from "drizzle-orm";

import type { AccountSessionAccessRuntime } from "./session-access";
import {
  createTauriSessionAccess,
  isTauriAuthCodeChallenge,
  TAURI_AUTH_CODE_CONSUMED_EVENT_ID_PREFIX,
  TAURI_AUTH_CODE_CONSUMED_EVENT_TYPE,
  type TauriAuthCodeRecord,
  type TauriSessionAccess,
} from "./tauri-session";

function parseCodeRecord(value: string): TauriAuthCodeRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("codeChallenge" in parsed) ||
      typeof parsed.codeChallenge !== "string" ||
      !isTauriAuthCodeChallenge(parsed.codeChallenge) ||
      !("sessionId" in parsed) ||
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.length === 0
    ) {
      return null;
    }
    return {
      codeChallenge: parsed.codeChallenge,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}

export function createDatabaseTauriSessionAccess(
  database: Database,
  accountSessionAccess: AccountSessionAccessRuntime,
  securityEventDatabase: SecurityEventDatabase,
): TauriSessionAccess {
  return createTauriSessionAccess({
    authorizeSession: (principal) =>
      accountSessionAccess.authorizeWrite(principal),
    codeStore: {
      async find(identifier, now) {
        const record = await database.query.verification.findFirst({
          columns: {
            expiresAt: true,
            value: true,
          },
          where: and(
            eq(verification.identifier, identifier),
            gt(verification.expiresAt, now),
          ),
        });
        return record ? parseCodeRecord(record.value) : null;
      },
      async consume(identifier, now) {
        const [record] = await database
          .delete(verification)
          .where(
            and(
              eq(verification.identifier, identifier),
              gt(verification.expiresAt, now),
            ),
          )
          .returning({ value: verification.value });
        return record ? parseCodeRecord(record.value) : null;
      },
      async create(identifier, record, expiresAt) {
        await database.insert(verification).values({
          expiresAt,
          id: crypto.randomUUID(),
          identifier,
          value: JSON.stringify(record),
        });
      },
    },
    consumedCodes: {
      async record(identifier, occurredAt) {
        const [event] = await securityEventDatabase
          .insert(securityEvent)
          .values({
            actorAlias: "tauri-auth-code-exchange",
            id: `${TAURI_AUTH_CODE_CONSUMED_EVENT_ID_PREFIX}${identifier}`,
            occurredAt,
            targetSessionAlias: identifier,
            type: TAURI_AUTH_CODE_CONSUMED_EVENT_TYPE,
            version: 1,
          })
          .onConflictDoNothing({ target: securityEvent.id })
          .returning({ id: securityEvent.id });
        return Boolean(event);
      },
    },
    sessions: {
      async find(sessionId) {
        const record = await database.query.session.findFirst({
          columns: {
            expiresAt: true,
            token: true,
            userId: true,
          },
          where: eq(session.id, sessionId),
        });
        return record
          ? {
              accountId: record.userId,
              expiresAt: record.expiresAt,
              token: record.token,
            }
          : null;
      },
    },
  });
}
