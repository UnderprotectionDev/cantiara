import type { TrashRecordKind } from "@cantiara/api/trash";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { externalSurface } from "@cantiara/db/schema/external-surface";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import { work } from "@cantiara/db/schema/work";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { TrashRecordFacts } from "./trash";

export type TrashRecordExecutor = Pick<Database, "select" | "update">;

/**
 * One adapter per record kind. It only reads the owner record and stamps its
 * own `trashed_at`; it never rewrites an existing record's columns beyond that
 * stamp and the revision bump that makes a stale writer lose. A new kind is a
 * new entry here plus its CHECK value in `trash_entry`, nothing else.
 */
export interface TrashRecordAdapter {
  read: (
    executor: TrashRecordExecutor,
    projectId: string,
    recordId: string,
  ) => Promise<TrashRecordFacts | null>;
  /** Stamps the record trashed at `baseRevision`; `false` when it did not match. */
  stamp: (
    executor: TrashRecordExecutor,
    projectId: string,
    recordId: string,
    baseRevision: number,
    at: Date,
  ) => Promise<boolean>;
}

type TrashableTable =
  | typeof decision
  | typeof document
  | typeof risk
  | typeof screen
  | typeof work;

function adapterFor(table: TrashableTable): TrashRecordAdapter {
  const scope = (projectId: string, recordId: string) =>
    and(eq(table.id, recordId), eq(table.projectId, projectId));
  return {
    async read(executor, projectId, recordId) {
      const [row] = await executor
        .select({
          revision: table.revision,
          title: table.title,
          trashedAt: table.trashedAt,
        })
        .from(table)
        .where(scope(projectId, recordId))
        .limit(1);
      return row
        ? {
            label: row.title,
            revision: row.revision,
            trashed: row.trashedAt !== null,
          }
        : null;
    },
    async stamp(executor, projectId, recordId, baseRevision, at) {
      const stamped = await executor
        .update(table)
        .set({ revision: sql`${table.revision} + 1`, trashedAt: at })
        .where(
          and(
            scope(projectId, recordId),
            eq(table.revision, baseRevision),
            isNull(table.trashedAt),
          ),
        )
        .returning({ id: table.id });
      return stamped.length > 0;
    },
  };
}

/**
 * A Dis yuzey has no title; its kind is the label. Only a revoked surface
 * (terminal `cancelled_at`) may move, so Trash never keeps a live URL alive.
 */
const externalSurfaceAdapter: TrashRecordAdapter = {
  async read(executor, projectId, recordId) {
    const [row] = await executor
      .select({
        cancelledAt: externalSurface.cancelledAt,
        revision: externalSurface.revision,
        surfaceKind: externalSurface.surfaceKind,
        trashedAt: externalSurface.trashedAt,
      })
      .from(externalSurface)
      .where(
        and(
          eq(externalSurface.id, recordId),
          eq(externalSurface.projectId, projectId),
        ),
      )
      .limit(1);
    return row
      ? {
          label: row.surfaceKind ?? "External Surface",
          movable: row.cancelledAt !== null,
          revision: row.revision,
          trashed: row.trashedAt !== null,
        }
      : null;
  },
  async stamp(executor, projectId, recordId, baseRevision, at) {
    const stamped = await executor
      .update(externalSurface)
      .set({ revision: sql`${externalSurface.revision} + 1`, trashedAt: at })
      .where(
        and(
          eq(externalSurface.id, recordId),
          eq(externalSurface.projectId, projectId),
          eq(externalSurface.revision, baseRevision),
          isNull(externalSurface.trashedAt),
          isNotNull(externalSurface.cancelledAt),
        ),
      )
      .returning({ id: externalSurface.id });
    return stamped.length > 0;
  },
};

/** The first-slice registry. Configuration kinds and the rest are later adapters. */
export const trashRecordAdapters: Record<TrashRecordKind, TrashRecordAdapter> =
  {
    Decision: adapterFor(decision),
    "External Surface": externalSurfaceAdapter,
    Document: adapterFor(document),
    Risk: adapterFor(risk),
    Screen: adapterFor(screen),
    Work: adapterFor(work),
  };
