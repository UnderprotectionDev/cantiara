import type { ExportField, ExportRecordType } from "@cantiara/api/data-export";
import { ExportError } from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { decision } from "@cantiara/db/schema/decision";
import { feedback } from "@cantiara/db/schema/feedback";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { researchSession } from "@cantiara/db/schema/research-session";
import { risk } from "@cantiara/db/schema/risk";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { validationRecord } from "@cantiara/db/schema/validation-record";
import { and, asc, eq, getTableColumns, inArray, isNull } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { ExportSourceReader, ExportSourceRecord } from "./selected-export";
import {
  ownsProject,
  readCustomFields,
} from "./selected-export-database-support";

type RecordTable = PgTable & {
  id: PgColumn;
  projectId: PgColumn;
  trashedAt?: PgColumn;
};

interface RecordFamily {
  /** Owned observation columns that leave as components inside the owner. */
  components?: Record<string, string[]>;
  label: (row: Record<string, unknown>) => string;
  table: RecordTable;
}

/** Columns that never leave: the Project scope and Trash bookkeeping. */
const BASE_EXCLUDE = ["projectId", "trashedAt"];

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function label(...keys: string[]) {
  return (row: Record<string, unknown>) =>
    keys.map((key) => textOf(row[key])).find(Boolean) ?? textOf(row.id);
}

const FAMILIES: Partial<Record<ExportRecordType, RecordFamily>> = {
  Assumption: { label: label("title", "statement"), table: assumption },
  Decision: { label: label("title"), table: decision },
  Feedback: { label: label("title"), table: feedback },
  Milestone: { label: label("title"), table: projectMilestone },
  "Open Question": { label: label("title", "question"), table: openQuestion },
  "Production Incident": { label: label("title"), table: productionIncident },
  "Project Goal": { label: label("title"), table: projectGoal },
  "Project Release": {
    // Erişim and Sonuç gözlemi are owned components, never standalone types.
    components: {
      accessObservation: ["accessEvidence"],
      outcomeObservation: ["outcomeEvidence"],
    },
    label: label("name", "versionLabel"),
    table: projectRelease,
  },
  "Research Session": { label: label("id"), table: researchSession },
  Risk: { label: label("title"), table: risk },
  "Validation Record": { label: label("title"), table: validationRecord },
};

function fieldLabel(key: string): string {
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function plain(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function fieldsOf(family: RecordFamily): ExportField[] {
  const hidden = new Set([
    ...BASE_EXCLUDE,
    ...Object.values(family.components ?? {}).flat(),
  ]);
  return Object.keys(getTableColumns(family.table))
    .filter((key) => !hidden.has(key))
    .map((key) => ({ key, label: fieldLabel(key) }));
}

const SOURCE_FIELDS: ExportField[] = [
  { key: "title", label: "Title" },
  { key: "url", label: "URL" },
  { key: "accessedAt", label: "Accessed" },
  { key: "provider", label: "Provider" },
  { key: "externalRecordType", label: "External record type" },
  { key: "externalId", label: "External ID" },
  { key: "revision", label: "Revision" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

function rejectFilters(filters: Record<string, string>, recordType: string) {
  const [key] = Object.keys(filters);
  if (key) {
    throw new ExportError(
      "source_unavailable",
      `The filter ${key} is not supported for ${recordType}.`,
    );
  }
}

function componentsOf(family: RecordFamily, row: Record<string, unknown>) {
  const components: Record<string, unknown[]> = {};
  for (const [component, columns] of Object.entries(family.components ?? {})) {
    const observed: Record<string, unknown> = {};
    for (const column of columns) {
      observed[column] = row[column] ?? null;
    }
    components[component] = Object.values(observed).some(Boolean)
      ? [observed]
      : [];
  }
  return components;
}

function createFamilyReader(
  database: Database,
  family: RecordFamily,
): ExportSourceReader {
  return {
    fields: () => fieldsOf(family),
    async read({ accountId, filters, limit, recordIds, recordType, scope }) {
      rejectFilters(filters, recordType);
      if (!(await ownsProject(database, accountId, scope.projectId))) {
        return null;
      }
      const { table } = family;
      const rows = (await database
        .select()
        .from(table)
        .where(
          and(
            eq(table.projectId, scope.projectId),
            table.trashedAt ? isNull(table.trashedAt) : undefined,
            recordIds?.length ? inArray(table.id, [...recordIds]) : undefined,
          ),
        )
        .orderBy(asc(table.id))
        .limit(limit)) as Record<string, unknown>[];
      const custom = await readCustomFields(
        database,
        scope.projectId,
        recordType,
        rows.map((row) => String(row.id)),
      );
      const fieldKeys = fieldsOf(family).map((field) => field.key);
      const records: ExportSourceRecord[] = rows.map((row) => {
        const values: Record<string, unknown> = {};
        for (const key of fieldKeys) {
          values[key] = plain(row[key]);
        }
        return {
          ...(family.components
            ? { components: componentsOf(family, row) }
            : {}),
          customFieldValues: custom.values.get(String(row.id)),
          id: String(row.id),
          label: family.label(row),
          values,
        };
      });
      return {
        customFieldDefinitions: custom.definitions,
        records,
        relations: [],
      };
    },
  };
}

/**
 * Read-only readers for the project-scoped record types that are plain
 * tables. Each returns only the owning account's records of one Project, at
 * most `limit`, and never writes. Contact, Company and Product Gap are
 * Workspace-wide records and have no reader yet.
 */
export function createDatabaseRecordExportSources(
  database: Database,
): Partial<Record<ExportRecordType, ExportSourceReader>> {
  const sources: Partial<Record<ExportRecordType, ExportSourceReader>> = {};
  for (const [name, family] of Object.entries(FAMILIES)) {
    sources[name as ExportRecordType] = createFamilyReader(database, family);
  }
  sources.Source = createSourceReader(database);
  return sources;
}

/**
 * Source metadata only: the latest saved version's URL, title, access time and
 * external identity. The captured historical body is not a trusted Source
 * snapshot from an outside file, so it never leaves.
 */
function createSourceReader(database: Database): ExportSourceReader {
  return {
    fields: () => SOURCE_FIELDS,
    async read({ accountId, filters, limit, recordIds, recordType, scope }) {
      rejectFilters(filters, recordType);
      if (!(await ownsProject(database, accountId, scope.projectId))) {
        return null;
      }
      const rows = await database
        .select({
          accessedAt: sourceVersion.accessedAt,
          createdAt: source.createdAt,
          externalId: sourceVersion.externalId,
          externalRecordType: sourceVersion.externalRecordType,
          id: source.id,
          provider: sourceVersion.provider,
          revision: source.revision,
          title: sourceVersion.title,
          updatedAt: source.updatedAt,
          url: sourceVersion.url,
        })
        .from(source)
        .innerJoin(
          sourceVersion,
          and(
            eq(sourceVersion.sourceId, source.id),
            eq(sourceVersion.revision, source.revision),
          ),
        )
        .where(
          and(
            eq(source.projectId, scope.projectId),
            recordIds?.length ? inArray(source.id, [...recordIds]) : undefined,
          ),
        )
        .orderBy(asc(source.id))
        .limit(limit);
      const custom = await readCustomFields(
        database,
        scope.projectId,
        recordType,
        rows.map((row) => row.id),
      );
      return {
        customFieldDefinitions: custom.definitions,
        records: rows.map((row) => ({
          customFieldValues: custom.values.get(row.id),
          id: row.id,
          label: row.title,
          values: {
            accessedAt: row.accessedAt.toISOString(),
            createdAt: row.createdAt.toISOString(),
            externalId: row.externalId,
            externalRecordType: row.externalRecordType,
            provider: row.provider,
            revision: row.revision,
            title: row.title,
            updatedAt: row.updatedAt.toISOString(),
            url: row.url,
          },
        })),
        relations: [],
      };
    },
  };
}
