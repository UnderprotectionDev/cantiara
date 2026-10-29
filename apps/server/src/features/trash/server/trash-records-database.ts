import type { TrashRecordKind } from "@cantiara/api/trash";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { externalSurface } from "@cantiara/db/schema/external-surface";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { TrashRecordFacts } from "./trash";
import { trashConfigurationAdapters } from "./trash-configuration-database";
import { trashGithubExternalRecordAdapter } from "./trash-github-database";
import { trashTestSessionAdapter } from "./trash-test-session-database";

export type TrashRecordExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;

/**
 * One adapter per record kind. It only reads the owner record and stamps its
 * own `trashed_at`; it never rewrites an existing record's columns beyond that
 * stamp and the revision bump that makes a stale writer lose. A new kind is a
 * new entry here plus its CHECK value in `trash_entry`, nothing else.
 */
export interface TrashRecordAdapter {
  /**
   * Removes the record's content. Returns a content-free GitHub tombstone
   * description for a GitHub external record kind (none in the first slice).
   */
  erase: (
    executor: TrashRecordExecutor,
    recordId: string,
    options?: { requireTrashed?: boolean },
  ) => Promise<{ githubTombstone?: GithubTombstoneInput } | null>;
  /** Ids among `recordIds` that still exist (an old backup may bring one back). */
  existing: (
    executor: TrashRecordExecutor,
    recordIds: readonly string[],
  ) => Promise<string[]>;
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
  /**
   * Restore: clears the stamp of the same row at the trashed revision, so the
   * identity and scope never change; `false` when it did not match.
   */
  unstamp: (
    executor: TrashRecordExecutor,
    projectId: string,
    recordId: string,
    trashedRevision: number,
  ) => Promise<boolean>;
}

/** A GitHub external record's content-free identity for the resurrection tombstone. */
export interface GithubTombstoneInput {
  githubId: number;
  kind: string;
  linkId: string;
  number: number;
  recordId: string;
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
    async erase(executor, recordId, options) {
      const deleted = await executor
        .delete(table)
        .where(
          and(
            eq(table.id, recordId),
            options?.requireTrashed ? isNotNull(table.trashedAt) : undefined,
          ),
        )
        .returning({ id: table.id });
      return deleted.length > 0 ? {} : null;
    },
    async existing(executor, recordIds) {
      if (recordIds.length === 0) {
        return [];
      }
      const rows = await executor
        .select({ id: table.id })
        .from(table)
        .where(inArray(table.id, [...recordIds]));
      return rows.map((row) => row.id);
    },
    async unstamp(executor, projectId, recordId, trashedRevision) {
      const cleared = await executor
        .update(table)
        .set({ revision: sql`${table.revision} + 1`, trashedAt: null })
        .where(
          and(
            scope(projectId, recordId),
            eq(table.revision, trashedRevision),
            isNotNull(table.trashedAt),
          ),
        )
        .returning({ id: table.id });
      return cleared.length > 0;
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
  async erase(executor, recordId, options) {
    const deleted = await executor
      .delete(externalSurface)
      .where(
        and(
          eq(externalSurface.id, recordId),
          options?.requireTrashed
            ? isNotNull(externalSurface.trashedAt)
            : undefined,
        ),
      )
      .returning({ id: externalSurface.id });
    return deleted.length > 0 ? {} : null;
  },
  async existing(executor, recordIds) {
    if (recordIds.length === 0) {
      return [];
    }
    const rows = await executor
      .select({ id: externalSurface.id })
      .from(externalSurface)
      .where(inArray(externalSurface.id, [...recordIds]));
    return rows.map((row) => row.id);
  },
  // A restored surface record stays revoked: only the Trash stamp is cleared,
  // `cancelled_at` and `frozen_revision` are never touched.
  async unstamp(executor, projectId, recordId, trashedRevision) {
    const cleared = await executor
      .update(externalSurface)
      .set({ revision: sql`${externalSurface.revision} + 1`, trashedAt: null })
      .where(
        and(
          eq(externalSurface.id, recordId),
          eq(externalSurface.projectId, projectId),
          eq(externalSurface.revision, trashedRevision),
          isNotNull(externalSurface.trashedAt),
        ),
      )
      .returning({ id: externalSurface.id });
    return cleared.length > 0;
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
    ...trashConfigurationAdapters,
    Decision: adapterFor(decision),
    "External Surface": externalSurfaceAdapter,
    Document: adapterFor(document),
    "GitHub External Record": trashGithubExternalRecordAdapter,
    Risk: adapterFor(risk),
    Screen: adapterFor(screen),
    "Test Session": trashTestSessionAdapter,
    Work: adapterFor(work),
  };
