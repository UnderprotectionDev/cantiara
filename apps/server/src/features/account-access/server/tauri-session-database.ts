import type { Database } from "@cantiara/db";
import { session, verification } from "@cantiara/db/schema/auth";
import { and, eq, gt } from "drizzle-orm";

import type { AccountSessionAccessRuntime } from "./session-access";
import {
  createTauriSessionAccess,
  type TauriSessionAccess,
} from "./tauri-session";

export function createDatabaseTauriSessionAccess(
  database: Database,
  accountSessionAccess: AccountSessionAccessRuntime,
): TauriSessionAccess {
  return createTauriSessionAccess({
    authorizeSession: (principal) =>
      accountSessionAccess.authorizeWrite(principal),
    codeStore: {
      async consume(identifier, now) {
        const [record] = await database
          .delete(verification)
          .where(
            and(
              eq(verification.identifier, identifier),
              gt(verification.expiresAt, now),
            ),
          )
          .returning({ sessionId: verification.value });
        return record?.sessionId ?? null;
      },
      async create(identifier, sessionId, expiresAt) {
        await database.insert(verification).values({
          expiresAt,
          id: crypto.randomUUID(),
          identifier,
          value: sessionId,
        });
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
