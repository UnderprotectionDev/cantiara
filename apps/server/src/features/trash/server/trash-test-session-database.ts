import { testSession } from "@cantiara/db/schema/planned-test";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { TrashRecordAdapter } from "./trash-records-database";

const MAX_LABEL = 255;

/**
 * Test Session (Test Oturumu, story 34): the session row carries the one
 * `trashed_at` stamp and its Session Tests (Oturum Testi) are owned
 * components that travel with it, so they have no stamp or Trash entry of
 * their own and "Session Test" stays child-only. Readers of sessions skip a
 * trashed one, which hides its tests with it. A permanent delete removes the
 * session row; the tests, reviews, results, bindings, follow-ups, identity
 * and attention signals follow through their cascading foreign keys, so the
 * historical whole is erased as one unit.
 */
export const trashTestSessionAdapter: TrashRecordAdapter = {
  async read(executor, projectId, recordId) {
    const [row] = await executor
      .select({
        externalSessionId: testSession.externalSessionId,
        revision: testSession.revision,
        summary: testSession.summary,
        trashedAt: testSession.trashedAt,
      })
      .from(testSession)
      .where(
        and(eq(testSession.id, recordId), eq(testSession.projectId, projectId)),
      )
      .limit(1);
    return row
      ? {
          label: (
            row.summary?.trim() || `Test Session ${row.externalSessionId}`
          ).slice(0, MAX_LABEL),
          revision: row.revision,
          trashed: row.trashedAt !== null,
        }
      : null;
  },
  async erase(executor, recordId) {
    const deleted = await executor
      .delete(testSession)
      .where(eq(testSession.id, recordId))
      .returning({ id: testSession.id });
    return deleted.length > 0 ? {} : null;
  },
  async existing(executor, recordIds) {
    if (recordIds.length === 0) {
      return [];
    }
    const rows = await executor
      .select({ id: testSession.id })
      .from(testSession)
      .where(inArray(testSession.id, [...recordIds]));
    return rows.map((row) => row.id);
  },
  async unstamp(executor, projectId, recordId, trashedRevision) {
    const cleared = await executor
      .update(testSession)
      .set({ revision: sql`${testSession.revision} + 1`, trashedAt: null })
      .where(
        and(
          eq(testSession.id, recordId),
          eq(testSession.projectId, projectId),
          eq(testSession.revision, trashedRevision),
          isNotNull(testSession.trashedAt),
        ),
      )
      .returning({ id: testSession.id });
    return cleared.length > 0;
  },
  async stamp(executor, projectId, recordId, baseRevision, at) {
    const stamped = await executor
      .update(testSession)
      .set({ revision: sql`${testSession.revision} + 1`, trashedAt: at })
      .where(
        and(
          eq(testSession.id, recordId),
          eq(testSession.projectId, projectId),
          eq(testSession.revision, baseRevision),
          isNull(testSession.trashedAt),
        ),
      )
      .returning({ id: testSession.id });
    return stamped.length > 0;
  },
};
