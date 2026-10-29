import { trashRecordKey } from "@cantiara/api/trash";
import {
  customFieldValueStillMeaningful,
  type TrashConfigurationImpact,
  type TrashConfigurationKind,
  type TrashDependent,
  type TrashRestoreConflict,
} from "@cantiara/api/trash-configuration";
import type { Database } from "@cantiara/db";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { documentTemplate } from "@cantiara/db/schema/document-template";
import {
  prioritizationSession,
  prioritizationSessionWork,
} from "@cantiara/db/schema/prioritization-session";
import { recordAction } from "@cantiara/db/schema/record-action";
import {
  smartCollection,
  smartCollectionView,
} from "@cantiara/db/schema/smart-collection";
import {
  workAutomationRule,
  workAutomationRuleVersion,
} from "@cantiara/db/schema/work-automation";
import { workTemplate } from "@cantiara/db/schema/work-template";
import { and, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { TrashConfigurationPort } from "./trash";
import type {
  TrashRecordAdapter,
  TrashRecordExecutor,
} from "./trash-records-database";

type ConfigurationTable =
  | typeof customFieldDefinition
  | typeof documentTemplate
  | typeof prioritizationSession
  | typeof recordAction
  | typeof smartCollection
  | typeof workAutomationRule
  | typeof workTemplate;

/**
 * One adapter per configuration kind, reusing the definition's own row and
 * `trashed_at` column: stamping bumps the revision and sets the stamp, restore
 * clears it at the trashed revision, so the internal id, the definition and
 * every stored value never change. An Automation Rule is also disabled while
 * in Trash (the rule's own trash path does the same) and stays disabled after
 * restore until the founder enables it again on purpose.
 */
function configurationAdapter(
  table: ConfigurationTable,
  options: { disableOnStamp?: boolean } = {},
): TrashRecordAdapter {
  const scope = (projectId: string, recordId: string) =>
    and(eq(table.id, recordId), eq(table.projectId, projectId));
  return {
    async read(executor, projectId, recordId) {
      const [row] = await executor
        .select({
          name: table.name,
          revision: table.revision,
          trashedAt: table.trashedAt,
        })
        .from(table)
        .where(scope(projectId, recordId))
        .limit(1);
      return row
        ? {
            label: row.name,
            revision: row.revision,
            trashed: row.trashedAt !== null,
          }
        : null;
    },
    async erase(executor, recordId) {
      const deleted = await executor
        .delete(table)
        .where(eq(table.id, recordId))
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
        .set({
          ...(options.disableOnStamp ? { enabled: false } : {}),
          revision: sql`${table.revision} + 1`,
          trashedAt: at,
        })
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

export const trashConfigurationAdapters: Record<
  TrashConfigurationKind,
  TrashRecordAdapter
> = {
  "Automation Rule": configurationAdapter(workAutomationRule, {
    disableOnStamp: true,
  }),
  "Custom Field": configurationAdapter(customFieldDefinition),
  "Document Template": configurationAdapter(documentTemplate),
  "Prioritization Session": configurationAdapter(prioritizationSession),
  "Record Action": configurationAdapter(recordAction),
  "Smart Collection": configurationAdapter(smartCollection),
  "Work Template": configurationAdapter(workTemplate),
};

interface FieldRow {
  id: string;
  name: string;
  options: string[];
  trashedAt: Date | null;
  type: string;
}

interface FieldValue {
  kind: string;
  option?: string;
  options?: string[];
}

interface FieldReference {
  definitionId: string;
  /** `null` when the reference holds no value that could change meaning. */
  value: FieldValue | null;
}

function templateReferences(
  defaults: { definitionId: string; value: FieldValue }[],
): FieldReference[] {
  return defaults.map(({ definitionId, value }) => ({ definitionId, value }));
}

function recordActionReferences(steps: unknown[]): FieldReference[] {
  const references: FieldReference[] = [];
  for (const step of steps as {
    definitionId?: string;
    kind?: string;
    value?: FieldValue;
  }[]) {
    if (step.kind === "custom-field-value" && step.definitionId) {
      references.push({
        definitionId: step.definitionId,
        value:
          step.value && step.value.kind !== "runtime-input" ? step.value : null,
      });
    }
  }
  return references;
}

/**
 * Configuration Trash behind the Trash seam: what a delete affects (stored
 * values, dependent views and references) and which dependencies a restore
 * could not resolve. It only reads; it never retargets a reference.
 */
export function createDatabaseTrashConfiguration(
  database: Database,
): TrashConfigurationPort {
  const executor: TrashRecordExecutor = database;

  async function fields(projectId: string, ids: string[]) {
    const rows = await executor
      .select({
        id: customFieldDefinition.id,
        name: customFieldDefinition.name,
        options: customFieldDefinition.options,
        trashedAt: customFieldDefinition.trashedAt,
        type: customFieldDefinition.type,
      })
      .from(customFieldDefinition)
      .where(
        and(
          eq(customFieldDefinition.projectId, projectId),
          inArray(customFieldDefinition.id, ids),
        ),
      );
    return new Map<string, FieldRow>(rows.map((row) => [row.id, row]));
  }

  async function referencesOf(
    projectId: string,
    ref: { id: string; kind: string },
  ): Promise<FieldReference[]> {
    if (ref.kind === "Work Template") {
      const [row] = await executor
        .select({ customFieldDefaults: workTemplate.customFieldDefaults })
        .from(workTemplate)
        .where(
          and(
            eq(workTemplate.id, ref.id),
            eq(workTemplate.projectId, projectId),
          ),
        )
        .limit(1);
      return row ? templateReferences(row.customFieldDefaults) : [];
    }
    if (ref.kind === "Record Action") {
      const [row] = await executor
        .select({ steps: recordAction.steps })
        .from(recordAction)
        .where(
          and(
            eq(recordAction.id, ref.id),
            eq(recordAction.projectId, projectId),
          ),
        )
        .limit(1);
      return row ? recordActionReferences(row.steps) : [];
    }
    return [];
  }

  async function countOf(query: Promise<{ total: number }[]>) {
    const [row] = await query;
    return row?.total ?? 0;
  }

  async function customFieldDependents(projectId: string, fieldId: string) {
    const [templates, actions] = await Promise.all([
      executor
        .select({
          customFieldDefaults: workTemplate.customFieldDefaults,
          id: workTemplate.id,
          name: workTemplate.name,
        })
        .from(workTemplate)
        .where(
          and(
            eq(workTemplate.projectId, projectId),
            isNull(workTemplate.trashedAt),
          ),
        ),
      executor
        .select({
          id: recordAction.id,
          name: recordAction.name,
          steps: recordAction.steps,
        })
        .from(recordAction)
        .where(
          and(
            eq(recordAction.projectId, projectId),
            isNull(recordAction.trashedAt),
          ),
        ),
    ]);
    const dependents: TrashDependent[] = [
      ...templates
        .filter((row) =>
          templateReferences(row.customFieldDefaults).some(
            (reference) => reference.definitionId === fieldId,
          ),
        )
        .map((row) => ({
          id: row.id,
          kind: "Work Template",
          label: row.name,
        })),
      ...actions
        .filter((row) =>
          recordActionReferences(row.steps).some(
            (reference) => reference.definitionId === fieldId,
          ),
        )
        .map((row) => ({
          id: row.id,
          kind: "Record Action",
          label: row.name,
        })),
    ];
    return dependents;
  }

  return {
    async impact(projectId, ref) {
      const impact: TrashConfigurationImpact = {
        dependents: [],
        storedValues: [],
      };
      const stored = (label: string, total: number) =>
        impact.storedValues.push({ count: total, label });
      switch (ref.kind) {
        case "Custom Field":
          stored(
            "Custom field values on records",
            await countOf(
              executor
                .select({ total: count() })
                .from(customFieldValue)
                .where(eq(customFieldValue.definitionId, ref.id)),
            ),
          );
          impact.dependents.push(
            ...(await customFieldDependents(projectId, ref.id)),
          );
          break;
        case "Smart Collection": {
          const views = await executor
            .select({
              id: smartCollectionView.id,
              name: smartCollectionView.name,
            })
            .from(smartCollectionView)
            .where(eq(smartCollectionView.collectionId, ref.id));
          stored("Named views", views.length);
          impact.dependents.push(
            ...views.map((view) => ({
              id: view.id,
              kind: "Named view",
              label: view.name,
            })),
          );
          break;
        }
        case "Automation Rule":
          stored(
            "Saved rule versions",
            await countOf(
              executor
                .select({ total: count() })
                .from(workAutomationRuleVersion)
                .where(eq(workAutomationRuleVersion.ruleId, ref.id)),
            ),
          );
          break;
        case "Prioritization Session":
          stored(
            "Ordered Work items",
            await countOf(
              executor
                .select({ total: count() })
                .from(prioritizationSessionWork)
                .where(
                  and(
                    eq(prioritizationSessionWork.projectId, projectId),
                    eq(prioritizationSessionWork.sessionId, ref.id),
                  ),
                ),
            ),
          );
          break;
        default:
          break;
      }
      return impact;
    },

    async restoreConflicts(projectId, ref, unit) {
      const references = await referencesOf(projectId, ref);
      if (references.length === 0) {
        return [];
      }
      const found = await fields(
        projectId,
        references.map(({ definitionId }) => definitionId),
      );
      const conflicts: TrashRestoreConflict[] = [];
      for (const reference of references) {
        const field = found.get(reference.definitionId);
        const base = {
          dependencyId: reference.definitionId,
          dependencyKind: "Custom Field",
        };
        if (!field) {
          conflicts.push({
            ...base,
            label: `Custom Field ${reference.definitionId}`,
            reason: "Permanently deleted",
          });
        } else if (
          field.trashedAt !== null &&
          !unit.has(trashRecordKey({ id: field.id, kind: "Custom Field" }))
        ) {
          conflicts.push({ ...base, label: field.name, reason: "In Trash" });
        } else if (
          reference.value &&
          !customFieldValueStillMeaningful(field, reference.value)
        ) {
          conflicts.push({
            ...base,
            label: field.name,
            reason: "Meaning changed",
          });
        }
      }
      return conflicts;
    },
  };
}
