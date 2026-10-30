import type { DataImportAccess } from "@cantiara/api/data-import";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
import { dataImportStaging } from "@cantiara/db/schema/data-import";
import { project } from "@cantiara/db/schema/project";
import { and, asc, eq, isNull, lte } from "drizzle-orm";

import {
  createDataImport,
  type DataImportPorts,
  type ImportScopeFacts,
  type ImportStagingStore,
  type StagedImport,
  type StagedImportRequest,
} from "./data-import";
import type { ImportSealer } from "./data-import-envelope";

function createStagingStore(database: Database): ImportStagingStore {
  return {
    async get(accountId, id) {
      const [row] = await database
        .select()
        .from(dataImportStaging)
        .where(
          and(
            eq(dataImportStaging.id, id),
            eq(dataImportStaging.accountId, accountId),
          ),
        )
        .limit(1);
      if (!row) {
        return null;
      }
      return {
        accountId: row.accountId,
        byteSize: row.byteSize,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        id: row.id,
        request: row.request as unknown as StagedImportRequest,
        rowCount: row.rowCount,
        sealed: {
          ciphertext: row.ciphertext,
          keyVersion: row.keyVersion,
          wrappedDataKey: row.wrappedDataKey,
        },
      } satisfies StagedImport;
    },

    async purgeExpired(now) {
      const removed = await database
        .delete(dataImportStaging)
        .where(lte(dataImportStaging.expiresAt, now))
        .returning({ id: dataImportStaging.id });
      return removed.length;
    },

    async put(staged) {
      await database.insert(dataImportStaging).values({
        accountId: staged.accountId,
        byteSize: staged.byteSize,
        ciphertext: staged.sealed.ciphertext,
        createdAt: staged.createdAt,
        expiresAt: staged.expiresAt,
        id: staged.id,
        keyVersion: staged.sealed.keyVersion,
        request: staged.request as unknown as Record<string, unknown>,
        rowCount: staged.rowCount,
        wrappedDataKey: staged.sealed.wrappedDataKey,
      });
    },
  };
}

function createScopes(database: Database): DataImportPorts["scopes"] {
  return async (accountId, scope): Promise<ImportScopeFacts | null> => {
    if (scope.kind === "project") {
      const [row] = await database
        .select({ name: project.name })
        .from(project)
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(
          and(
            eq(project.id, scope.projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!row) {
        return null;
      }
      const fields = await database
        .select({ name: customFieldDefinition.name })
        .from(customFieldDefinition)
        .where(
          and(
            eq(customFieldDefinition.projectId, scope.projectId),
            isNull(customFieldDefinition.trashedAt),
          ),
        )
        .orderBy(asc(customFieldDefinition.name));
      return {
        customFieldNames: fields.map((field) => field.name),
        label: row.name,
      };
    }
    const [owned] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    if (!owned) {
      return null;
    }
    return {
      customFieldNames: [],
      label: scope.kind === "wiki" ? "Wiki" : "Workspace",
    };
  };
}

/**
 * Standard Import wired to PostgreSQL. The preview reads the target scope and
 * writes only `data_import_staging`. Import origins are kept by Apply Import
 * (a later ticket), so until that exists no earlier origin is known and every
 * keyed row previews as a new record.
 */
export function createDatabaseDataImport(
  database: Database,
  sealer: ImportSealer,
): DataImportAccess & { purgeExpired: (now?: Date) => Promise<number> } {
  const staging = createStagingStore(database);
  const access = createDataImport({
    origins: () => Promise.resolve(new Map()),
    scopes: createScopes(database),
    sealer,
    staging,
  });
  return {
    ...access,
    purgeExpired: (now = new Date()) => staging.purgeExpired(now),
  };
}
