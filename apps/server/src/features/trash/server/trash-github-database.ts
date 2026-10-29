import { githubExternalRecord } from "@cantiara/db/schema/github-integration";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { TrashRecordAdapter } from "./trash-records-database";

const MAX_LABEL = 255;

/**
 * GitHub External Record (story 29, 35): the local copy of an issue or Pull
 * request moves to Trash on its own row and `trashed_at`, the same stamp the
 * GitHub feature's write gate reads (a trashed record refuses new source
 * writes, so a webhook or reconcile never mutates it). Restore keeps the
 * product id and sets `needs_reconcile`: the missed source state is applied
 * only by an explicit Sync now. A permanent delete returns the content-free
 * tombstone identity (kind, source id, link, number, local alias) that the
 * expiry store writes so a later webhook cannot resurrect the record.
 */
export const trashGithubExternalRecordAdapter: TrashRecordAdapter = {
  async read(executor, projectId, recordId) {
    const [row] = await executor
      .select({
        number: githubExternalRecord.number,
        revision: githubExternalRecord.revision,
        title: githubExternalRecord.title,
        trashedAt: githubExternalRecord.trashedAt,
      })
      .from(githubExternalRecord)
      .where(
        and(
          eq(githubExternalRecord.id, recordId),
          eq(githubExternalRecord.projectId, projectId),
        ),
      )
      .limit(1);
    return row
      ? {
          label: `#${row.number} ${row.title}`.slice(0, MAX_LABEL),
          revision: row.revision,
          trashed: row.trashedAt !== null,
        }
      : null;
  },
  async erase(executor, recordId) {
    const [deleted] = await executor
      .delete(githubExternalRecord)
      .where(eq(githubExternalRecord.id, recordId))
      .returning({
        githubId: githubExternalRecord.githubId,
        kind: githubExternalRecord.kind,
        linkId: githubExternalRecord.linkId,
        number: githubExternalRecord.number,
        recordId: githubExternalRecord.id,
      });
    return deleted ? { githubTombstone: deleted } : null;
  },
  async existing(executor, recordIds) {
    if (recordIds.length === 0) {
      return [];
    }
    const rows = await executor
      .select({ id: githubExternalRecord.id })
      .from(githubExternalRecord)
      .where(inArray(githubExternalRecord.id, [...recordIds]));
    return rows.map((row) => row.id);
  },
  async unstamp(executor, projectId, recordId, trashedRevision) {
    const cleared = await executor
      .update(githubExternalRecord)
      .set({
        needsReconcile: true,
        revision: sql`${githubExternalRecord.revision} + 1`,
        trashedAt: null,
      })
      .where(
        and(
          eq(githubExternalRecord.id, recordId),
          eq(githubExternalRecord.projectId, projectId),
          eq(githubExternalRecord.revision, trashedRevision),
          isNotNull(githubExternalRecord.trashedAt),
        ),
      )
      .returning({ id: githubExternalRecord.id });
    return cleared.length > 0;
  },
  async stamp(executor, projectId, recordId, baseRevision, at) {
    const stamped = await executor
      .update(githubExternalRecord)
      .set({
        revision: sql`${githubExternalRecord.revision} + 1`,
        trashedAt: at,
      })
      .where(
        and(
          eq(githubExternalRecord.id, recordId),
          eq(githubExternalRecord.projectId, projectId),
          eq(githubExternalRecord.revision, baseRevision),
          isNull(githubExternalRecord.trashedAt),
        ),
      )
      .returning({ id: githubExternalRecord.id });
    return stamped.length > 0;
  },
};
