import {
  type SpecCandidateRecordResolution,
  type SpecChangeReviewMark,
  specCandidateRecordKey,
  specReviewStateSchema,
} from "@cantiara/api/spec-change-review-candidates";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import {
  specChangeReview,
  specChangeReviewMark,
} from "@cantiara/db/schema/spec-change-review";
import { technicalDiagram } from "@cantiara/db/schema/technical-diagram";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

interface TitledTable {
  id: PgColumn;
  projectId: PgColumn;
  title: PgColumn;
}

const TITLED_TABLES: Record<string, TitledTable & PgTable> = {
  Assumption: assumption as unknown as TitledTable & PgTable,
  Decision: decision as unknown as TitledTable & PgTable,
  "Open Question": openQuestion as unknown as TitledTable & PgTable,
  Risk: risk as unknown as TitledTable & PgTable,
  "Technical Diagram": technicalDiagram as unknown as TitledTable & PgTable,
};

type Resolutions = Map<string, SpecCandidateRecordResolution>;

function idsOf(
  records: { recordId: string; recordType: string }[],
  recordType: string,
) {
  return records
    .filter((record) => record.recordType === recordType)
    .map((record) => record.recordId);
}

async function resolveWorks(
  database: Database,
  accountId: string,
  ids: string[],
  resolutions: Resolutions,
) {
  if (ids.length === 0) {
    return;
  }
  const rows = await database
    .select({
      archivedAt: work.archivedAt,
      id: work.id,
      key: work.key,
      projectArchivedAt: project.archivedAt,
      projectId: work.projectId,
      title: work.title,
      trashedAt: work.trashedAt,
    })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(and(inArray(work.id, ids), eq(workspace.ownerAccountId, accountId)));
  for (const row of rows) {
    const resolutionKey = specCandidateRecordKey({
      recordId: row.id,
      recordType: "Work",
    });
    if (row.trashedAt) {
      resolutions.set(resolutionKey, {
        at: row.trashedAt.toISOString(),
        projectId: row.projectId,
        reason: "In Trash",
        status: "unavailable",
      });
    } else if (row.archivedAt || row.projectArchivedAt) {
      resolutions.set(resolutionKey, {
        at: (row.archivedAt ?? row.projectArchivedAt)?.toISOString() ?? null,
        projectId: row.projectId,
        reason: "Archived",
        status: "unavailable",
      });
    } else {
      resolutions.set(resolutionKey, {
        label: row.key,
        projectId: row.projectId,
        status: "available",
        title: row.title,
      });
    }
  }
}

async function resolveDocuments(
  database: Database,
  accountId: string,
  ids: string[],
  resolutions: Resolutions,
) {
  if (ids.length === 0) {
    return;
  }
  const rows = await database
    .select({
      archivedAt: document.archivedAt,
      id: document.id,
      projectArchivedAt: project.archivedAt,
      projectId: document.projectId,
      title: document.title,
    })
    .from(document)
    .leftJoin(project, eq(document.projectId, project.id))
    .innerJoin(
      workspace,
      eq(
        workspace.id,
        sql`coalesce(${document.workspaceId}, ${project.workspaceId})`,
      ),
    )
    .where(
      and(inArray(document.id, ids), eq(workspace.ownerAccountId, accountId)),
    );
  for (const row of rows) {
    const resolutionKey = specCandidateRecordKey({
      recordId: row.id,
      recordType: "Document",
    });
    const archivedAt = row.archivedAt ?? row.projectArchivedAt;
    resolutions.set(
      resolutionKey,
      archivedAt
        ? {
            at: archivedAt.toISOString(),
            projectId: row.projectId,
            reason: "Archived",
            status: "unavailable",
          }
        : {
            label: null,
            projectId: row.projectId,
            status: "available",
            title: row.title,
          },
    );
  }
}

async function resolveTitled(
  database: Database,
  accountId: string,
  recordType: string,
  ids: string[],
  resolutions: Resolutions,
) {
  const table = TITLED_TABLES[recordType];
  if (!table || ids.length === 0) {
    return;
  }
  const rows = (await database
    .select({
      archivedAt: project.archivedAt,
      id: table.id,
      projectId: table.projectId,
      title: table.title,
    })
    .from(table)
    .innerJoin(project, eq(table.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(inArray(table.id, ids), eq(workspace.ownerAccountId, accountId)),
    )) as {
    archivedAt: Date | null;
    id: string;
    projectId: string;
    title: string;
  }[];
  for (const row of rows) {
    resolutions.set(
      specCandidateRecordKey({ recordId: row.id, recordType }),
      row.archivedAt
        ? {
            at: row.archivedAt.toISOString(),
            projectId: row.projectId,
            reason: "Archived",
            status: "unavailable",
          }
        : {
            label: null,
            projectId: row.projectId,
            status: "available",
            title: row.title,
          },
    );
  }
}

/**
 * Resolves candidate records the account owns. Record types without a
 * resolver here fail closed (omitted, so the shared broken-reference
 * presentation reads `No access`), like the shared relation endpoint
 * resolvers: an unknown record is never named.
 */
export async function resolveCandidateRecords(
  database: Database,
  accountId: string,
  records: { recordId: string; recordType: string }[],
): Promise<Resolutions> {
  const resolutions: Resolutions = new Map();
  await Promise.all([
    resolveWorks(database, accountId, idsOf(records, "Work"), resolutions),
    resolveDocuments(
      database,
      accountId,
      idsOf(records, "Document"),
      resolutions,
    ),
    ...Object.keys(TITLED_TABLES).map((recordType) =>
      resolveTitled(
        database,
        accountId,
        recordType,
        idsOf(records, recordType),
        resolutions,
      ),
    ),
  ]);
  return resolutions;
}

export function toMark(
  row: typeof specChangeReviewMark.$inferSelect,
): SpecChangeReviewMark {
  return {
    candidate: {
      recordId: row.recordId,
      recordType: row.recordType,
      sectionId: row.sectionId === "" ? null : row.sectionId,
    },
    id: row.id,
    note: row.note,
    reviewId: row.reviewId,
    revision: row.revision,
    state: specReviewStateSchema.parse(row.state),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function readMarks(
  database: Database,
  accountId: string,
  reviewId: string,
): Promise<SpecChangeReviewMark[]> {
  const rows = await database
    .select({ mark: specChangeReviewMark })
    .from(specChangeReviewMark)
    .innerJoin(
      specChangeReview,
      eq(specChangeReviewMark.reviewId, specChangeReview.id),
    )
    .innerJoin(project, eq(specChangeReview.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(specChangeReviewMark.reviewId, reviewId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  return rows.map(({ mark }) => toMark(mark));
}
