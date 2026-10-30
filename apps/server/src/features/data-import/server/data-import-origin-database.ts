import type { Database } from "@cantiara/db";
import { dataImportOrigin } from "@cantiara/db/schema/data-import";
import { document } from "@cantiara/db/schema/document";
import { work, workRetiredIdentity } from "@cantiara/db/schema/work";
import { and, desc, eq, inArray } from "drizzle-orm";

import type {
  DataImportPorts,
  ImportOriginQuery,
  ImportOriginState,
} from "./data-import";
import { importScopeColumns } from "./data-import-write-database";

type OriginScope = Parameters<DataImportPorts["origins"]>[1];

/** The newest origin row per key: a repeated source keeps every earlier row. */
async function newestRecordIds(
  database: Database,
  accountId: string,
  scope: OriginScope,
  query: ImportOriginQuery,
) {
  const columns = importScopeColumns(scope);
  const rows = await database
    .select({
      originKey: dataImportOrigin.originKey,
      recordId: dataImportOrigin.recordId,
    })
    .from(dataImportOrigin)
    .where(
      and(
        eq(dataImportOrigin.accountId, accountId),
        eq(dataImportOrigin.scopeKind, columns.scopeKind),
        eq(dataImportOrigin.scopeId, columns.scopeId),
        eq(dataImportOrigin.recordType, query.catalogType),
        eq(dataImportOrigin.provenance, query.provenance),
        inArray(dataImportOrigin.originKey, [...query.keys]),
      ),
    )
    .orderBy(desc(dataImportOrigin.createdAt), desc(dataImportOrigin.id));
  const newest = new Map<string, string>();
  for (const row of rows) {
    if (!newest.has(row.originKey)) {
      newest.set(row.originKey, row.recordId);
    }
  }
  return newest;
}

/** Titles of the records that still live, keyed by id. */
async function livingTitles(
  database: Database,
  catalogType: ImportOriginQuery["catalogType"],
  recordIds: readonly string[],
) {
  const found =
    catalogType === "Document"
      ? await database
          .select({ id: document.id, title: document.title })
          .from(document)
          .where(inArray(document.id, [...recordIds]))
      : await database
          .select({ id: work.id, title: work.title })
          .from(work)
          .where(inArray(work.id, [...recordIds]));
  return new Map(found.map((row) => [row.id, row.title]));
}

/** Ids of Work merged away: they stay retired and are never reused. */
async function retiredIds(
  database: Database,
  catalogType: ImportOriginQuery["catalogType"],
  recordIds: readonly string[],
) {
  if (catalogType === "Document") {
    return new Set<string>();
  }
  const merged = await database
    .select({ id: workRetiredIdentity.id })
    .from(workRetiredIdentity)
    .where(inArray(workRetiredIdentity.id, [...recordIds]));
  return new Set(merged.map((row) => row.id));
}

/**
 * Exact-origin lookup for the preview (read only). It reads
 * `data_import_origin` under the same provider/file scope, record type and
 * Project, and resolves only the newest origin per key against the primary
 * stores: a living record is matchable; a merged-away Work id is `retired`;
 * anything else is `permanently deleted`. An origin never authorizes reusing
 * a product id: a deleted or retired origin only shows as the previous origin
 * of a new identity.
 */
export function createDatabaseOrigins(
  database: Database,
): DataImportPorts["origins"] {
  return async (accountId, scope, query) => {
    const states = new Map<string, ImportOriginState>();
    if (query.keys.length === 0) {
      return states;
    }
    const newest = await newestRecordIds(database, accountId, scope, query);
    const recordIds = [...new Set(newest.values())];
    if (recordIds.length === 0) {
      return states;
    }
    const living = await livingTitles(database, query.catalogType, recordIds);
    const retired = await retiredIds(database, query.catalogType, recordIds);
    for (const [originKey, recordId] of newest) {
      const title = living.get(recordId);
      if (title !== undefined) {
        states.set(originKey, { recordId, state: "living", title });
      } else if (retired.has(recordId)) {
        states.set(originKey, { state: "retired" });
      } else {
        states.set(originKey, { state: "permanently deleted" });
      }
    }
    return states;
  };
}
