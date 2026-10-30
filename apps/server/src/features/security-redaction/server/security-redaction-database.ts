// biome-ignore-all lint/performance/noAwaitInLoops: rows are rewritten one at a time inside one transaction.
import type { ExternalSurfaceResponseCache } from "@cantiara/api/external-surface-access";
import {
  redactJson,
  redactText,
  type SecurityRedactionLocator,
  type SecurityRedactionLocatorKind,
  type SecurityRedactionLocatorSource,
  type SecurityRedactionRequest,
  type SecurityRedactionTargetAdapter,
} from "@cantiara/api/security-redaction";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document, documentConflictDraft } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { and, eq, inArray, or, type SQLWrapper, sql } from "drizzle-orm";

/**
 * Real stores behind the Security Redaction spread (spec 78 #505): Document
 * current content (title, body, inline tags, conflict drafts), the record
 * history store of those Documents (history, receipts, staged changes,
 * mutation targets), External Surface Approved Snapshot Revisions and the
 * External Surface delivery cache. Each store scans in one transaction and,
 * when it removes, rewrites matches in place with the content-free mark, so
 * actor, time and shape stay and no value does. A copy is found by the
 * value alone, so a leaked Secret is cleaned the same way as any other value.
 * Nothing here changes `cancelled_at`, the access epoch, token or password
 * hash, `frozen_revision` or any trash column: an External Surface is never
 * reactivated and no URL or token is minted. The value is never logged.
 */

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const MARK_BATCH = 200;

/** The JSON text form of a value, for a `jsonb::text` pre-filter. */
function jsonEscaped(value: string) {
  return JSON.stringify(value).slice(1, -1);
}

function textHas(column: SQLWrapper, value: string) {
  return sql<boolean>`strpos(${column}, ${value}) > 0`;
}

function jsonHas(column: SQLWrapper, value: string) {
  return sql<boolean>`strpos(${column}::text, ${jsonEscaped(value)}) > 0`;
}

async function workspaceIdOf(executor: Executor, accountId: string) {
  const [row] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return row?.id ?? null;
}

/** Documents of the scope: an Account's Personal Wiki and Projects, or one Project. */
async function scopedDocumentCondition(
  executor: Executor,
  request: SecurityRedactionRequest,
) {
  if (request.scope.kind === "Project") {
    return eq(document.projectId, request.scope.projectId);
  }
  const workspaceId = await workspaceIdOf(executor, request.accountId);
  if (!workspaceId) {
    return null;
  }
  return or(
    eq(document.workspaceId, workspaceId),
    inArray(
      document.projectId,
      executor
        .select({ id: project.id })
        .from(project)
        .where(eq(project.workspaceId, workspaceId)),
    ),
  );
}

async function scopedSurfaceIds(
  executor: Executor,
  request: SecurityRedactionRequest,
) {
  const workspaceId = await workspaceIdOf(executor, request.accountId);
  if (!workspaceId) {
    return [];
  }
  const rows = await executor
    .select({ id: externalSurface.id })
    .from(externalSurface)
    .where(
      and(
        eq(externalSurface.workspaceId, workspaceId),
        request.scope.kind === "Project"
          ? eq(externalSurface.projectId, request.scope.projectId)
          : undefined,
      ),
    );
  return rows.map((row) => row.id);
}

function chunks<T>(items: T[]) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += MARK_BATCH) {
    result.push(items.slice(index, index + MARK_BATCH));
  }
  return result;
}

/** Applies `redactJson` to named columns; returns only the changed ones. */
function redactedColumns<Row extends Record<string, unknown>>(
  row: Row,
  columns: readonly (keyof Row & string)[],
  value: string,
) {
  const patch: Record<string, unknown> = {};
  for (const column of columns) {
    const current = row[column];
    if (current === null || current === undefined) {
      continue;
    }
    const result =
      typeof current === "string"
        ? {
            changed: redactText(current, value) !== current,
            value: redactText(current, value),
          }
        : redactJson(current, value);
    if (result.changed) {
      patch[column] = result.value;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

type Scan = (
  executor: Executor,
  request: SecurityRedactionRequest,
  remove: boolean,
) => Promise<SecurityRedactionLocator[]>;

/** Document current content: title, body, inline tags and conflict drafts. */
const scanCurrent: Scan = async (executor, request, remove) => {
  const condition = await scopedDocumentCondition(executor, request);
  if (!condition) {
    return [];
  }
  const value = request.sensitiveValue;
  const found: SecurityRedactionLocator[] = [];
  const documents = await executor
    .select()
    .from(document)
    .where(
      and(
        condition,
        or(
          textHas(document.title, value),
          textHas(document.body, value),
          jsonHas(document.inlineTags, value),
        ),
      ),
    );
  for (const row of documents) {
    const patch = redactedColumns(row, ["title", "body", "inlineTags"], value);
    if (!patch) {
      continue;
    }
    for (const field of ["title", "body", "inlineTags"] as const) {
      if (field in patch) {
        found.push({
          kind: "current-field",
          location: field === "inlineTags" ? "inline tags" : field,
          recordId: row.id,
          recordKind: "Document",
        });
      }
    }
    if (remove) {
      // A new revision makes a stale client save conflict instead of
      // writing the old value back over the redacted content.
      await executor
        .update(document)
        .set({ ...patch, revision: sql`${document.revision} + 1` })
        .where(eq(document.id, row.id));
    }
  }

  const drafts = await executor
    .select()
    .from(documentConflictDraft)
    .where(
      and(
        inArray(
          documentConflictDraft.documentId,
          executor.select({ id: document.id }).from(document).where(condition),
        ),
        or(
          textHas(documentConflictDraft.title, value),
          textHas(documentConflictDraft.body, value),
        ),
      ),
    );
  for (const row of drafts) {
    const patch = redactedColumns(row, ["title", "body"], value);
    if (!patch) {
      continue;
    }
    found.push({
      kind: "current-field",
      location: "conflict draft",
      recordId: row.documentId,
      recordKind: "Document",
    });
    if (remove) {
      await executor
        .update(documentConflictDraft)
        .set(patch)
        .where(eq(documentConflictDraft.id, row.id));
    }
  }
  return found;
};

type HistoryPass = (
  executor: Executor,
  batch: string[],
  request: SecurityRedactionRequest,
  remove: boolean,
) => Promise<{ location: string; recordId: string }[]>;

const historyRows: HistoryPass = async (executor, batch, request, remove) => {
  const value = request.sensitiveValue;
  const rows = await executor
    .select()
    .from(mutationHistory)
    .where(
      and(
        inArray(mutationHistory.targetId, batch),
        or(
          jsonHas(mutationHistory.previousValue, value),
          jsonHas(mutationHistory.nextValue, value),
          jsonHas(mutationHistory.undo, value),
        ),
      ),
    );
  const found: { location: string; recordId: string }[] = [];
  for (const row of rows) {
    const patch = redactedColumns(
      row,
      ["previousValue", "nextValue", "undo"],
      value,
    );
    if (patch) {
      found.push({
        location: `revision ${row.revision}`,
        recordId: row.targetId,
      });
      if (remove) {
        await executor
          .update(mutationHistory)
          .set(patch)
          .where(eq(mutationHistory.id, row.id));
      }
    }
  }
  return found;
};

const receiptRows: HistoryPass = async (executor, batch, request, remove) => {
  const value = request.sensitiveValue;
  const rows = await executor
    .select()
    .from(mutationReceipt)
    .where(
      and(
        inArray(mutationReceipt.targetId, batch),
        or(
          jsonHas(mutationReceipt.previousValue, value),
          jsonHas(mutationReceipt.nextValue, value),
          jsonHas(mutationReceipt.undo, value),
        ),
      ),
    );
  const found: { location: string; recordId: string }[] = [];
  for (const row of rows) {
    const patch = redactedColumns(
      row,
      ["previousValue", "nextValue", "undo"],
      value,
    );
    if (patch) {
      found.push({
        location: `receipt revision ${row.revision}`,
        recordId: row.targetId,
      });
      if (remove) {
        await executor
          .update(mutationReceipt)
          .set(patch)
          .where(eq(mutationReceipt.id, row.id));
      }
    }
  }
  return found;
};

const stagedRows: HistoryPass = async (executor, batch, request, remove) => {
  const value = request.sensitiveValue;
  const rows = await executor
    .select()
    .from(mutationStaging)
    .where(
      and(
        inArray(mutationStaging.targetId, batch),
        or(
          jsonHas(mutationStaging.payload, value),
          jsonHas(mutationStaging.rollbackCurrentValue, value),
          jsonHas(mutationStaging.undo, value),
        ),
      ),
    );
  const found: { location: string; recordId: string }[] = [];
  for (const row of rows) {
    const patch = redactedColumns(
      row,
      ["payload", "rollbackCurrentValue", "undo"],
      value,
    );
    if (patch) {
      found.push({ location: "staged change", recordId: row.targetId });
      if (remove) {
        await executor
          .update(mutationStaging)
          .set(patch)
          .where(eq(mutationStaging.id, row.id));
      }
    }
  }
  return found;
};

const targetRows: HistoryPass = async (executor, batch, request, remove) => {
  const value = request.sensitiveValue;
  const rows = await executor
    .select()
    .from(mutationTarget)
    .where(
      and(
        inArray(mutationTarget.id, batch),
        jsonHas(mutationTarget.value, value),
      ),
    );
  const found: { location: string; recordId: string }[] = [];
  for (const row of rows) {
    const patch = redactedColumns(row, ["value"], value);
    if (patch) {
      found.push({ location: "mutation target", recordId: row.id });
      if (remove) {
        await executor
          .update(mutationTarget)
          .set({ ...patch, revision: sql`${mutationTarget.revision} + 1` })
          .where(eq(mutationTarget.id, row.id));
      }
    }
  }
  return found;
};

/** The record history store of the scoped Documents: every revision, receipt and staged change. */
const scanHistory: Scan = async (executor, request, remove) => {
  const condition = await scopedDocumentCondition(executor, request);
  if (!condition) {
    return [];
  }
  const ids = (
    await executor.select({ id: document.id }).from(document).where(condition)
  ).map((row) => row.id);
  const found: SecurityRedactionLocator[] = [];
  for (const batch of chunks(ids)) {
    for (const pass of [historyRows, receiptRows, stagedRows, targetRows]) {
      for (const copy of await pass(executor, batch, request, remove)) {
        found.push({
          kind: "history-revision",
          location: copy.location,
          recordId: copy.recordId,
          recordKind: "Document",
        });
      }
    }
  }
  return found;
};

/**
 * Approved Snapshot Revisions of the scoped External Surfaces. Only the
 * stored `snapshot` is rewritten: the surface row, its revision number and
 * its access state stay exactly as they were.
 */
const scanSnapshots: Scan = async (executor, request, remove) => {
  const surfaceIds = await scopedSurfaceIds(executor, request);
  const value = request.sensitiveValue;
  const found: SecurityRedactionLocator[] = [];
  for (const batch of chunks(surfaceIds)) {
    const rows = await executor
      .select()
      .from(externalSurfaceSnapshotRevision)
      .where(
        and(
          inArray(externalSurfaceSnapshotRevision.surfaceId, batch),
          jsonHas(externalSurfaceSnapshotRevision.snapshot, value),
        ),
      );
    for (const row of rows) {
      const patch = redactedColumns(row, ["snapshot"], value);
      if (!patch) {
        continue;
      }
      found.push({
        kind: "external-surface-snapshot",
        location: `revision ${row.revision}`,
        recordId: row.surfaceId,
        recordKind: "External Surface",
      });
      if (remove) {
        await executor
          .update(externalSurfaceSnapshotRevision)
          .set(patch)
          .where(eq(externalSurfaceSnapshotRevision.id, row.id));
      }
    }
  }
  return found;
};

const SCANS: Record<
  Exclude<
    SecurityRedactionLocatorKind,
    "cache" | "export-staging" | "search-index"
  >,
  Scan
> = {
  "current-field": scanCurrent,
  "external-surface-snapshot": scanSnapshots,
  "history-revision": scanHistory,
};

/** Locator sources for the preview: reads only, one per real store. */
export function createDatabaseSecurityRedactionLocators(
  database: Database,
): SecurityRedactionLocatorSource[] {
  return (Object.keys(SCANS) as (keyof typeof SCANS)[]).map((kind) => ({
    kind,
    locate: (request) =>
      database.transaction((transaction) =>
        SCANS[kind](transaction, request, false),
      ),
  }));
}

/** Removal adapters for the real stores; each runs in its own transaction. */
export function createDatabaseSecurityRedactionTargets(
  database: Database,
): SecurityRedactionTargetAdapter[] {
  return (Object.keys(SCANS) as (keyof typeof SCANS)[]).map((kind) => ({
    kind,
    remove: async (request) =>
      (
        await database.transaction((transaction) =>
          SCANS[kind](transaction, request, true),
        )
      ).length,
  }));
}

/**
 * The External Surface delivery cache. Cache keys carry the revision, so a
 * redacted snapshot of the same revision would otherwise keep serving the old
 * bytes: every scoped surface's entries are dropped, whether or not they held
 * the value. Run after the snapshot target.
 */
export function createSurfaceCacheRedactionTarget(
  database: Database,
  cache: ExternalSurfaceResponseCache,
): SecurityRedactionTargetAdapter {
  return {
    kind: "cache",
    async remove(request) {
      if (!cache.purge) {
        return 0;
      }
      const surfaceIds = await scopedSurfaceIds(database, request);
      for (const surfaceId of surfaceIds) {
        await cache.purge(surfaceId);
      }
      return surfaceIds.length;
    },
  };
}

/**
 * Universal search reads current content live (`to_tsvector` at query time),
 * so it keeps no index of its own: it is clean once current content is. This
 * adapter states that instead of claiming a purge.
 */
export const derivedSearchIndexTarget: SecurityRedactionTargetAdapter = {
  kind: "search-index",
  remove: () => Promise.resolve(null),
};
