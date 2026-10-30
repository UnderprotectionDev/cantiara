import type { ExportField, ExportRecordType } from "@cantiara/api/data-export";
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
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { ExportSourceReader, ExportSourceRecord } from "./selected-export";
import {
  guardExportRead,
  readCustomFields,
} from "./selected-export-database-support";
import { readExtraRelations } from "./selected-export-relations-database";

type RecordTable = PgTable & {
  id: PgColumn;
  projectId: PgColumn;
  trashedAt?: PgColumn;
};

interface RecordFamily {
  /** Owned observation columns that leave as components inside the owner. */
  components?: Record<string, string[]>;
  /**
   * The only columns that leave, in column order. Internal columns (revision,
   * Project scope, Trash bookkeeping, actor or account ids, fingerprints) are
   * never listed, so a new schema column stays private until it is added here.
   */
  fields: string[];
  label: (row: Record<string, unknown>) => string;
  /** Reads the field values when they are not plain columns of the row. */
  rowValues?: (row: Record<string, unknown>) => Record<string, unknown>;
  table: RecordTable;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function label(...keys: string[]) {
  return (row: Record<string, unknown>) =>
    keys.map((key) => textOf(row[key])).find(Boolean) ?? textOf(row.id);
}

const STAMPS = ["createdAt", "updatedAt"];

/**
 * Research Session keeps its fields in one validated `data` document. Only the
 * session's own fields leave: captured content (consent gated), the consent
 * recorder and the revision stay in the Workspace.
 */
const RESEARCH_SESSION_FIELDS = [
  "title",
  "purpose",
  "questionGuide",
  "status",
  "scheduledAt",
  "durationMinutes",
  "channel",
  "facilitator",
  "scopeNote",
  "participantContactId",
  "consent",
  "consentNote",
  ...STAMPS,
];

const FAMILIES: Partial<Record<ExportRecordType, RecordFamily>> = {
  Assumption: {
    fields: ["title", "statement", "rationale", "life", ...STAMPS],
    label: label("title", "statement"),
    table: assumption,
  },
  Decision: {
    fields: [
      "title",
      "decision",
      "rationale",
      "life",
      "withdrawnAt",
      "withdrawalRationale",
      ...STAMPS,
    ],
    label: label("title"),
    table: decision,
  },
  Feedback: {
    fields: [
      "title",
      "originalMessage",
      "channel",
      "occurredAt",
      "url",
      "status",
      ...STAMPS,
    ],
    label: label("title"),
    table: feedback,
  },
  Milestone: {
    fields: ["title", "description", "status", "targetDate", ...STAMPS],
    label: label("title"),
    table: projectMilestone,
  },
  "Open Question": {
    fields: [
      "title",
      "question",
      "context",
      "answer",
      "rationale",
      "life",
      ...STAMPS,
    ],
    label: label("title", "question"),
    table: openQuestion,
  },
  "Production Incident": {
    fields: [
      "title",
      "status",
      "occurredAt",
      "detectedHow",
      "impact",
      "rootCause",
      "resolution",
      "learning",
      ...STAMPS,
    ],
    label: label("title"),
    table: productionIncident,
  },
  "Project Goal": {
    fields: [
      "title",
      "description",
      "intendedOutcome",
      "observedOutcomeLearning",
      ...STAMPS,
    ],
    label: label("title"),
    table: projectGoal,
  },
  "Project Release": {
    // Erişim and Sonuç gözlemi are owned components, never standalone types.
    components: {
      accessObservation: ["accessEvidence"],
      outcomeObservation: ["outcomeEvidence"],
    },
    fields: [
      "name",
      "versionLabel",
      "description",
      "audience",
      "intendedOutcome",
      "primaryAccessPath",
      "status",
      ...STAMPS,
    ],
    label: label("name", "versionLabel"),
    table: projectRelease,
  },
  "Research Session": {
    fields: RESEARCH_SESSION_FIELDS,
    label: label("title"),
    rowValues: (row) => ({
      ...((row.data as Record<string, unknown> | null) ?? {}),
      id: row.id,
    }),
    table: researchSession,
  },
  Risk: {
    fields: [
      "title",
      "description",
      "impact",
      "probability",
      "response",
      "rationale",
      "life",
      ...STAMPS,
    ],
    label: label("title"),
    table: risk,
  },
  "Validation Record": {
    fields: ["title", "method", "result", "context", "status", ...STAMPS],
    label: label("title"),
    table: validationRecord,
  },
};

function fieldLabel(key: string): string {
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function plain(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function fieldsOf(family: RecordFamily): ExportField[] {
  return family.fields.map((key) => ({ key, label: fieldLabel(key) }));
}

const SOURCE_FIELDS: ExportField[] = [
  { key: "title", label: "Title" },
  { key: "url", label: "URL" },
  { key: "accessedAt", label: "Accessed" },
  { key: "provider", label: "Provider" },
  { key: "externalRecordType", label: "External record type" },
  { key: "externalId", label: "External ID" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

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
    async read(input) {
      const { limit, recordIds, recordType } = input;
      const projectId = await guardExportRead(database, input);
      if (!projectId) {
        return null;
      }
      const { table } = family;
      const rows = (await database
        .select()
        .from(table)
        .where(
          and(
            eq(table.projectId, projectId),
            table.trashedAt ? isNull(table.trashedAt) : undefined,
            recordIds?.length ? inArray(table.id, [...recordIds]) : undefined,
          ),
        )
        .orderBy(asc(table.id))
        .limit(limit)) as Record<string, unknown>[];
      const custom = await readCustomFields(
        database,
        projectId,
        recordType,
        rows.map((row) => String(row.id)),
      );
      const records: ExportSourceRecord[] = rows.map((row) => {
        const fromRow = family.rowValues ? family.rowValues(row) : row;
        const values: Record<string, unknown> = {};
        for (const key of family.fields) {
          values[key] = plain(fromRow[key]) ?? null;
        }
        return {
          ...(family.components
            ? { components: componentsOf(family, row) }
            : {}),
          customFieldValues: custom.values.get(String(row.id)),
          id: String(row.id),
          label: family.label(fromRow),
          values,
        };
      });
      return {
        customFieldDefinitions: custom.definitions,
        records,
        relations: await readExtraRelations(
          database,
          recordType,
          records.map((record) => record.id),
        ),
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
    async read(input) {
      const { limit, recordIds, recordType } = input;
      const projectId = await guardExportRead(database, input);
      if (!projectId) {
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
            eq(source.projectId, projectId),
            recordIds?.length ? inArray(source.id, [...recordIds]) : undefined,
          ),
        )
        .orderBy(asc(source.id))
        .limit(limit);
      const custom = await readCustomFields(
        database,
        projectId,
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
