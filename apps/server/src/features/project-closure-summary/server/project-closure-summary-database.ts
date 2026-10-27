import type { ClosureSummaryCandidate } from "@cantiara/api/project-closure-summary";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull } from "drizzle-orm";

import {
  createProjectClosureSummary,
  type ProjectClosureSummarySources,
} from "./project-closure-summary";

const MAX_CANDIDATES_PER_TYPE = 500;

/**
 * Reads only owner records that already exist and only for a Project the
 * account owns: Decisions, Risks, Project Releases, live Documents, Production
 * Incidents and completed Work that is neither archived nor in Trash. It
 * selects id and title only and never writes.
 */
export function createDatabaseProjectClosureSummarySources(
  database: Database,
): ProjectClosureSummarySources {
  return {
    candidates: (_accountId, projectId) =>
      database.transaction(async (executor) => {
        const [decisions, risks, releases, documents, incidents, works] =
          await Promise.all([
            executor
              .select({ id: decision.id, title: decision.title })
              .from(decision)
              .where(eq(decision.projectId, projectId))
              .orderBy(asc(decision.title))
              .limit(MAX_CANDIDATES_PER_TYPE),
            executor
              .select({ id: risk.id, title: risk.title })
              .from(risk)
              .where(eq(risk.projectId, projectId))
              .orderBy(asc(risk.title))
              .limit(MAX_CANDIDATES_PER_TYPE),
            executor
              .select({
                id: projectRelease.id,
                name: projectRelease.name,
                versionLabel: projectRelease.versionLabel,
              })
              .from(projectRelease)
              .where(eq(projectRelease.projectId, projectId))
              .orderBy(asc(projectRelease.name))
              .limit(MAX_CANDIDATES_PER_TYPE),
            executor
              .select({ id: document.id, title: document.title })
              .from(document)
              .where(
                and(
                  eq(document.projectId, projectId),
                  isNull(document.archivedAt),
                ),
              )
              .orderBy(asc(document.title))
              .limit(MAX_CANDIDATES_PER_TYPE),
            executor
              .select({
                id: productionIncident.id,
                title: productionIncident.title,
              })
              .from(productionIncident)
              .where(eq(productionIncident.projectId, projectId))
              .orderBy(asc(productionIncident.title))
              .limit(MAX_CANDIDATES_PER_TYPE),
            executor
              .select({ id: work.id, key: work.key, title: work.title })
              .from(work)
              .where(
                and(
                  eq(work.projectId, projectId),
                  eq(work.status, "Closed"),
                  eq(work.closureResult, "Completed"),
                  isNull(work.archivedAt),
                  isNull(work.trashedAt),
                ),
              )
              .orderBy(asc(work.key))
              .limit(MAX_CANDIDATES_PER_TYPE),
          ]);
        const candidates: ClosureSummaryCandidate[] = [
          ...decisions.map((row) => ({
            label: row.title,
            recordId: row.id,
            recordType: "Decision" as const,
          })),
          ...risks.map((row) => ({
            label: row.title,
            recordId: row.id,
            recordType: "Risk" as const,
          })),
          ...releases.map((row) => ({
            label: row.versionLabel
              ? `${row.name} ${row.versionLabel}`
              : row.name,
            recordId: row.id,
            recordType: "Project Release" as const,
          })),
          ...documents.map((row) => ({
            label: row.title,
            recordId: row.id,
            recordType: "Document" as const,
          })),
          ...incidents.map((row) => ({
            label: row.title,
            recordId: row.id,
            recordType: "Production Incident" as const,
          })),
          ...works.map((row) => ({
            label: `${row.key} ${row.title}`,
            recordId: row.id,
            recordType: "Work" as const,
          })),
        ];
        return candidates;
      }),
    projectStatus: async (accountId, projectId) => {
      const [owned] = await database
        .select({ status: project.status })
        .from(project)
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      return owned?.status ?? null;
    },
  };
}

export function createDatabaseProjectClosureSummary(database: Database) {
  return createProjectClosureSummary(
    createDatabaseProjectClosureSummarySources(database),
  );
}
