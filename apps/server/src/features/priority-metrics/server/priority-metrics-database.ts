import {
  getStarterPriorityMetricTemplate,
  type PriorityMetric,
  type PriorityMetricProjectValues,
  type PriorityMetricStore,
  type PriorityMetricValue,
  type PriorityMetricValueListItem,
  priorityMetricNameKey,
  priorityMetricSchema,
  priorityMetricValueSchema,
} from "@cantiara/api/priority-metrics";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";

type PriorityMetricDatabaseRecord =
  typeof priorityMetricDefinition.$inferSelect;
type PriorityMetricValueDatabaseRecord =
  typeof workPriorityMetricValue.$inferSelect;

export function starterPriorityMetricDefinitionValues(
  projectId: string,
  starterConfiguration: string,
  timestamp: Date,
) {
  const template = getStarterPriorityMetricTemplate(starterConfiguration);
  if (!template) {
    return null;
  }
  return {
    ...template,
    createdAt: timestamp,
    id: crypto.randomUUID(),
    nameKey: priorityMetricNameKey(template.name),
    projectId,
    revision: 0,
    updatedAt: timestamp,
  };
}

export function toPriorityMetric(
  record: PriorityMetricDatabaseRecord,
): PriorityMetric {
  return priorityMetricSchema.parse({
    createdAt: record.createdAt.toISOString(),
    enabled: record.enabled,
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    rankDescriptions: record.rankDescriptions,
    revision: record.revision,
    shortDescription: record.shortDescription,
    trashedAt: record.trashedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toPriorityMetricValue(
  record: PriorityMetricValueDatabaseRecord,
): PriorityMetricValue {
  return priorityMetricValueSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    metricId: record.metricId,
    projectId: record.projectId,
    rank: record.rank,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
    workId: record.workId,
  });
}

async function ownedProjectId(
  database: Database,
  workspaceId: string,
  projectId: string,
) {
  const [record] = await database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  return record?.id ?? null;
}

async function ownedWork(
  database: Database,
  workspaceId: string,
  workId: string,
) {
  const [record] = await database
    .select({ id: work.id, projectId: work.projectId })
    .from(work)
    .innerJoin(project, eq(project.id, work.projectId))
    .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  return record ?? null;
}

export function createDatabasePriorityMetrics(
  database: Database,
): PriorityMetricStore {
  return {
    async findWorkspaceId(accountId) {
      const [record] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      return record?.id ?? null;
    },

    async list(workspaceId, projectId) {
      if (!(await ownedProjectId(database, workspaceId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(priorityMetricDefinition)
        .where(eq(priorityMetricDefinition.projectId, projectId))
        .orderBy(asc(priorityMetricDefinition.createdAt));
      return records.map(toPriorityMetric);
    },

    async projectValues(workspaceId, projectId) {
      if (!(await ownedProjectId(database, workspaceId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(priorityMetricDefinition)
        .where(
          and(
            eq(priorityMetricDefinition.projectId, projectId),
            eq(priorityMetricDefinition.enabled, true),
            isNull(priorityMetricDefinition.trashedAt),
          ),
        )
        .orderBy(asc(priorityMetricDefinition.createdAt));
      const definitions = records.map(toPriorityMetric);
      if (definitions.length === 0) {
        return {
          definitions,
          values: [],
          valueRevisions: [],
        } satisfies PriorityMetricProjectValues;
      }
      const valueRecords = await database
        .select()
        .from(workPriorityMetricValue)
        .where(
          and(
            eq(workPriorityMetricValue.projectId, projectId),
            inArray(
              workPriorityMetricValue.metricId,
              definitions.map((definition) => definition.id),
            ),
          ),
        );
      return {
        definitions,
        values: valueRecords
          .filter((value) => value.rank !== null)
          .map(toPriorityMetricValue),
        valueRevisions: valueRecords.map(({ metricId, revision, workId }) => ({
          metricId,
          revision,
          workId,
        })),
      } satisfies PriorityMetricProjectValues;
    },

    async trashImpactPreview(workspaceId, metricId) {
      const [metric] = await database
        .select({ id: priorityMetricDefinition.id })
        .from(priorityMetricDefinition)
        .innerJoin(project, eq(project.id, priorityMetricDefinition.projectId))
        .where(
          and(
            eq(priorityMetricDefinition.id, metricId),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!metric) {
        return null;
      }
      const [valueCount] = await database
        .select({ storedWorkValueCount: count() })
        .from(workPriorityMetricValue)
        .where(
          and(
            eq(workPriorityMetricValue.metricId, metricId),
            isNotNull(workPriorityMetricValue.rank),
          ),
        );
      return {
        attachedExternalSurfaceCount: 0,
        dependentRuleCount: 0,
        dependentViewCount: 0,
        storedWorkValueCount: valueCount?.storedWorkValueCount ?? 0,
      };
    },

    async values(workspaceId, workId) {
      const workRecord = await ownedWork(database, workspaceId, workId);
      if (!workRecord) {
        return null;
      }
      const records = await database
        .select()
        .from(priorityMetricDefinition)
        .where(
          and(
            eq(priorityMetricDefinition.projectId, workRecord.projectId),
            eq(priorityMetricDefinition.enabled, true),
            isNull(priorityMetricDefinition.trashedAt),
          ),
        )
        .orderBy(asc(priorityMetricDefinition.createdAt));
      const definitions = records.map(toPriorityMetric);
      if (definitions.length === 0) {
        return [];
      }
      const values = await database
        .select()
        .from(workPriorityMetricValue)
        .where(
          and(
            eq(workPriorityMetricValue.projectId, workRecord.projectId),
            eq(workPriorityMetricValue.workId, workId),
            inArray(
              workPriorityMetricValue.metricId,
              definitions.map((definition) => definition.id),
            ),
          ),
        );
      const valuesByMetricId = new Map(
        values.map((value) => [value.metricId, value]),
      );
      return definitions.map((definition) => {
        const valueRecord = valuesByMetricId.get(definition.id);
        return {
          definition,
          value:
            valueRecord?.rank === null || !valueRecord
              ? null
              : toPriorityMetricValue(valueRecord),
          valueRevision: valueRecord?.revision ?? 0,
        };
      }) satisfies PriorityMetricValueListItem[];
    },
  };
}
