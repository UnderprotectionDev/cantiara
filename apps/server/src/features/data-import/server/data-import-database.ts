import type {
  DataImportAccess,
  ImportCatalogType,
  ImportReceipt,
} from "@cantiara/api/data-import";
import { createDatabaseMutationContract } from "@cantiara/api/mutation-contract-database";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
import {
  dataImportReceipt,
  dataImportStaging,
} from "@cantiara/db/schema/data-import";
import { project } from "@cantiara/db/schema/project";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";

import {
  createDataImport,
  type DataImportPorts,
  type ImportScopeFacts,
  type ImportStagingStore,
  type StagedImport,
  type StagedImportRequest,
} from "./data-import";
import type {
  ImportApplyPorts,
  ImportReceiptStore,
  ImportTargetValue,
} from "./data-import-apply";
import type { ImportSealer } from "./data-import-envelope";
import {
  unavailableImportWrite,
  writeImportPlan,
} from "./data-import-write-database";

function createStagingStore(database: Database): ImportStagingStore {
  return {
    async claim(accountId, id, key) {
      const claimed = await database
        .update(dataImportStaging)
        .set({ applyingKey: key })
        .where(
          and(
            eq(dataImportStaging.id, id),
            eq(dataImportStaging.accountId, accountId),
            or(
              isNull(dataImportStaging.applyingKey),
              eq(dataImportStaging.applyingKey, key),
            ),
          ),
        )
        .returning({ id: dataImportStaging.id });
      return claimed.length === 1;
    },

    async release(accountId, id) {
      await database
        .update(dataImportStaging)
        .set({ applyingKey: null })
        .where(
          and(
            eq(dataImportStaging.id, id),
            eq(dataImportStaging.accountId, accountId),
          ),
        );
    },

    async remove(accountId, id, { force }) {
      const owned = and(
        eq(dataImportStaging.id, id),
        eq(dataImportStaging.accountId, accountId),
      );
      const removed = await database
        .delete(dataImportStaging)
        .where(
          force ? owned : and(owned, isNull(dataImportStaging.applyingKey)),
        )
        .returning({ id: dataImportStaging.id });
      if (removed.length > 0) {
        return "removed";
      }
      const [still] = await database
        .select({ id: dataImportStaging.id })
        .from(dataImportStaging)
        .where(owned)
        .limit(1);
      return still ? "claimed" : "missing";
    },

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
        applyingKey: row.applyingKey,
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

function toReceipt(row: typeof dataImportReceipt.$inferSelect): ImportReceipt {
  return {
    catalogType: row.catalogType as ImportCatalogType | null,
    completedAt: row.completedAt.toISOString(),
    counts: row.counts as unknown as ImportReceipt["counts"],
    family: row.family as ImportReceipt["family"],
    fileName: row.fileName,
    finalSetFingerprint: row.finalSetFingerprint,
    idempotencyKey: row.idempotencyKey,
    provenance: row.provenance,
    ...(row.reason ? { reason: row.reason } : {}),
    scopeLabel: row.scopeLabel,
    status: row.status as ImportReceipt["status"],
    ...(row.supportReference ? { supportReference: row.supportReference } : {}),
  };
}

function createReceiptStore(database: Database): ImportReceiptStore {
  async function find(accountId: string, key: string) {
    const [row] = await database
      .select()
      .from(dataImportReceipt)
      .where(
        and(
          eq(dataImportReceipt.accountId, accountId),
          eq(dataImportReceipt.idempotencyKey, key),
        ),
      )
      .limit(1);
    return row ? toReceipt(row) : null;
  }
  return {
    get: find,
    async put(accountId, receipt) {
      await database
        .insert(dataImportReceipt)
        .values({
          accountId,
          catalogType: receipt.catalogType,
          completedAt: new Date(receipt.completedAt),
          counts: receipt.counts,
          family: receipt.family,
          fileName: receipt.fileName,
          finalSetFingerprint: receipt.finalSetFingerprint,
          id: crypto.randomUUID(),
          idempotencyKey: receipt.idempotencyKey,
          provenance: receipt.provenance,
          reason: receipt.reason ?? null,
          scopeLabel: receipt.scopeLabel,
          status: receipt.status,
          supportReference: receipt.supportReference ?? null,
        })
        .onConflictDoNothing();
      return (await find(accountId, receipt.idempotencyKey)) ?? receipt;
    },
  };
}

function createApplyPorts(database: Database): ImportApplyPorts {
  return {
    contract: (plan, options) =>
      createDatabaseMutationContract<ImportTargetValue>(database, {
        barrierChecks: options.barrierChecks,
        sourceVerifier: options.sourceVerifier,
        target: {
          find: (_executor, targetId) =>
            Promise.resolve({
              id: targetId,
              revision: 0,
              value: {
                created: 0,
                recordIds: [],
                state: "pending" as const,
                updated: 0,
              },
            }),
          async update(executor, input) {
            await writeImportPlan(executor, plan, input.committedAt);
            return {
              id: input.targetId,
              revision: input.expectedRevision + 1,
              value: input.nextValue,
            };
          },
        },
      }),
    receipts: createReceiptStore(database),
    unavailable: unavailableImportWrite,
  };
}

/**
 * Standard Import wired to PostgreSQL. The preview reads the target scope and
 * writes only `data_import_staging`. `Apply Import` writes the final set, its
 * import origins and the receipt through the Mutation Contract. The origin
 * lookup stays empty until the no-identity-resurrection ticket reads
 * `data_import_origin`, so every keyed row still previews as a new record.
 */
export function createDatabaseDataImport(
  database: Database,
  sealer: ImportSealer,
): DataImportAccess & { purgeExpired: (now?: Date) => Promise<number> } {
  const staging = createStagingStore(database);
  const access = createDataImport({
    apply: createApplyPorts(database),
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
