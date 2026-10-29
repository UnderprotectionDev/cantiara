import type {
  ClosureSummaryCandidate,
  ClosureSummaryDateFacts,
} from "@cantiara/api/project-closure-summary";
import type { Database } from "@cantiara/db";
import { accountPreferences, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  createProjectClosureSummary,
  type ProjectClosureSummarySources,
} from "./project-closure-summary";

const MAX_CANDIDATES_PER_TYPE = 500;
const DEFAULT_TIME_ZONE = "Europe/Istanbul";
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    // Reads the planned target dates the Work's own Kayıt geçmişi recorded and
    // the Work's closure event. No date is written or stored.
    dateFacts: async (accountId, projectId, records) => {
      const workIds = records
        .filter((record) => record.recordType === "Work")
        .map((record) => record.recordId);
      const [preferences] = await database
        .select({ timeZone: accountPreferences.timeZone })
        .from(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId));
      const timeZone = preferences?.timeZone ?? DEFAULT_TIME_ZONE;
      if (workIds.length === 0) {
        return { facts: [], timeZone };
      }
      const previousTarget = sql<
        string | null
      >`(${mutationHistory.previousValue} -> 'work' ->> 'targetDate')`;
      const nextTarget = sql<
        string | null
      >`(${mutationHistory.nextValue} -> 'work' ->> 'targetDate')`;
      const [works, changes] = await Promise.all([
        database
          .select({
            id: work.id,
            statusChangedAt: work.statusChangedAt,
            targetDate: work.targetDate,
          })
          .from(work)
          .where(
            and(
              eq(work.projectId, projectId),
              inArray(work.id, workIds),
              eq(work.status, "Closed"),
              eq(work.closureResult, "Completed"),
            ),
          ),
        database
          .select({
            next: nextTarget,
            previous: previousTarget,
            targetId: mutationHistory.targetId,
          })
          .from(mutationHistory)
          .where(
            and(
              inArray(mutationHistory.targetId, workIds),
              sql`${previousTarget} is distinct from ${nextTarget}`,
            ),
          )
          .orderBy(asc(mutationHistory.occurredAt)),
      ]);
      const datesOf = new Map<string, string[]>();
      for (const change of changes) {
        const dates = datesOf.get(change.targetId) ?? [];
        for (const date of [
          dates.length === 0 ? change.previous : null,
          change.next,
        ]) {
          if (date && LOCAL_DATE.test(date)) {
            dates.push(date);
          }
        }
        datesOf.set(change.targetId, dates);
      }
      const labelOf = new Map(
        records.map((record) => [record.recordId, record.label]),
      );
      const facts: ClosureSummaryDateFacts[] = works.map((row) => ({
        closedAt: row.statusChangedAt.toISOString(),
        currentTargetDate: row.targetDate,
        label: labelOf.get(row.id) ?? row.id,
        recordId: row.id,
        recordType: "Work",
        targetDates: datesOf.get(row.id) ?? [],
      }));
      return { facts, timeZone };
    },
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
                  isNull(document.trashedAt),
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
