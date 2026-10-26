import type {
  StoryEventFact,
  StoryEventKind,
  StoryScope,
  StorySourced,
  StoryTimelineFacts,
} from "@cantiara/api/project-history";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { workRelation } from "@cantiara/db/schema/relation";
import { screen } from "@cantiara/db/schema/screen";
import { validationRecord } from "@cantiara/db/schema/validation-record";
import { work } from "@cantiara/db/schema/work";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
  createProjectHistory,
  type ProjectHistorySources,
} from "./project-history";

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Sourced = StorySourced<StoryEventFact[]>;

const MAX_EVENTS_PER_KIND = 500;

const available = (value: StoryEventFact[]): Sourced => ({
  available: true,
  value,
});
const pending = (reason: string): Sourced => ({ available: false, reason });

const iso = (value: Date) => value.toISOString();

/** Realized events only. A field edit never reaches this adapter's output. */
const event = (
  recordType: StoryEventFact["source"]["recordType"],
  recordId: string,
  title: string,
  occurredAt: Date,
  state: string | null,
  abandonmentRationale: string | null = null,
): StoryEventFact => ({
  abandonmentRationale,
  occurredAt: iso(occurredAt),
  source: { label: title, recordId, recordType },
  state,
  title,
});

/** Related record ids of a given type for the Feature and its included Work. */
async function relatedIds(
  executor: Executor,
  workIds: string[],
  targetRecordType: string,
) {
  const rows = await executor
    .select({ id: workRelation.targetRecordId })
    .from(workRelation)
    .where(
      and(
        inArray(workRelation.sourceWorkId, workIds),
        eq(workRelation.targetRecordType, targetRecordType),
        isNull(workRelation.deletedAt),
      ),
    );
  return [...new Set(rows.map(({ id }) => id))];
}

async function readKinds(
  executor: Executor,
  scope: StoryScope,
): Promise<StoryTimelineFacts["sources"]> {
  const { projectId } = scope;
  const featureWorkIds =
    scope.kind === "Feature"
      ? [
          scope.workId,
          ...(
            await executor
              .select({ id: work.id })
              .from(work)
              .where(
                and(
                  eq(work.projectId, projectId),
                  eq(work.primaryFeatureId, scope.workId),
                ),
              )
          ).map(({ id }) => id),
        ]
      : null;

  /** Narrows an owner table to the Feature's related records, if scoped. */
  async function scoped(
    recordType: string,
    idColumn: AnyPgColumn,
  ): Promise<SQL | undefined | "none"> {
    if (!featureWorkIds) {
      return undefined;
    }
    const ids = await relatedIds(executor, featureWorkIds, recordType);
    return ids.length === 0 ? "none" : inArray(idColumn, ids);
  }

  const decisionScope = await scoped("Decision", decision.id);
  const documentScope = await scoped("Document", document.id);
  const milestoneScope = await scoped("Milestone", projectMilestone.id);
  const incidentScope = await scoped(
    "Production Incident",
    productionIncident.id,
  );
  const releaseScope = await scoped("Project Release", projectRelease.id);

  const decisions: Sourced =
    decisionScope === "none"
      ? available([])
      : available(
          (
            await executor
              .select()
              .from(decision)
              .where(and(eq(decision.projectId, projectId), decisionScope))
              .orderBy(asc(decision.createdAt))
              .limit(MAX_EVENTS_PER_KIND)
          ).flatMap((row) => [
            event("Decision", row.id, row.title, row.createdAt, "Decided"),
            ...(row.withdrawnAt
              ? [
                  event(
                    "Decision",
                    row.id,
                    row.title,
                    row.withdrawnAt,
                    "Withdrawn",
                  ),
                ]
              : []),
          ]),
        );

  const documents: Sourced =
    documentScope === "none"
      ? available([])
      : available(
          (
            await executor
              .select()
              .from(document)
              .where(
                and(
                  eq(document.projectId, projectId),
                  isNull(document.archivedAt),
                  documentScope,
                ),
              )
              .orderBy(asc(document.createdAt))
              .limit(MAX_EVENTS_PER_KIND)
          ).map((row) =>
            event("Document", row.id, row.title, row.createdAt, null),
          ),
        );

  const designs: Sourced = featureWorkIds
    ? pending(
        "Screens are not related to Work, so a Feature has no design read.",
      )
    : available(
        (
          await executor
            .select()
            .from(screen)
            .where(
              and(
                eq(screen.projectId, projectId),
                isNull(screen.archivedAt),
                isNull(screen.trashedAt),
              ),
            )
            .orderBy(asc(screen.createdAt))
            .limit(MAX_EVENTS_PER_KIND)
        ).map((row) => event("Screen", row.id, row.title, row.createdAt, null)),
      );

  const workScope = featureWorkIds
    ? inArray(work.id, featureWorkIds)
    : eq(work.projectId, projectId);
  const works: Sourced = available(
    (
      await executor
        .select()
        .from(work)
        .where(
          and(
            eq(work.projectId, projectId),
            workScope,
            eq(work.status, "Closed"),
            isNotNull(work.closureResult),
            isNull(work.trashedAt),
          ),
        )
        .orderBy(asc(work.statusChangedAt))
        .limit(MAX_EVENTS_PER_KIND)
    ).map((row) =>
      event(
        "Work",
        row.id,
        `${row.key} ${row.title}`,
        row.statusChangedAt,
        row.closureResult,
        row.closureResult === "Abandoned" ? row.closureReason : null,
      ),
    ),
  );

  const milestones: Sourced =
    milestoneScope === "none"
      ? available([])
      : available(
          (
            await executor
              .select()
              .from(projectMilestone)
              .where(
                and(
                  eq(projectMilestone.projectId, projectId),
                  inArray(projectMilestone.status, ["Reached", "Abandoned"]),
                  milestoneScope,
                ),
              )
              .orderBy(asc(projectMilestone.updatedAt))
              .limit(MAX_EVENTS_PER_KIND)
          ).map((row) =>
            event("Milestone", row.id, row.title, row.updatedAt, row.status),
          ),
        );

  const incidents: Sourced =
    incidentScope === "none"
      ? available([])
      : available(
          (
            await executor
              .select()
              .from(productionIncident)
              .where(
                and(eq(productionIncident.projectId, projectId), incidentScope),
              )
              .orderBy(asc(productionIncident.occurredAt))
              .limit(MAX_EVENTS_PER_KIND)
          ).map((row) =>
            event(
              "Production Incident",
              row.id,
              row.title,
              row.occurredAt,
              row.status,
            ),
          ),
        );

  const validations: Sourced = featureWorkIds
    ? pending(
        "Validation Records relate to Assumptions, Questions and Decisions, not to a Feature.",
      )
    : available(
        (
          await executor
            .select()
            .from(validationRecord)
            .where(
              and(
                eq(validationRecord.projectId, projectId),
                eq(validationRecord.status, "Active"),
                isNotNull(validationRecord.result),
              ),
            )
            .orderBy(asc(validationRecord.createdAt))
            .limit(MAX_EVENTS_PER_KIND)
        ).map((row) =>
          event(
            "Validation Record",
            row.id,
            row.title,
            row.createdAt,
            "Result recorded",
          ),
        ),
      );

  const releases: Sourced =
    releaseScope === "none"
      ? available([])
      : available(
          (
            await executor
              .select()
              .from(projectRelease)
              .where(
                and(
                  eq(projectRelease.projectId, projectId),
                  or(
                    eq(projectRelease.status, "Published"),
                    eq(projectRelease.status, "Cancelled"),
                  ),
                  releaseScope,
                ),
              )
              .orderBy(asc(projectRelease.updatedAt))
              .limit(MAX_EVENTS_PER_KIND)
          ).map((row) =>
            event(
              "Project Release",
              row.id,
              row.versionLabel ? `${row.name} ${row.versionLabel}` : row.name,
              row.updatedAt,
              row.status,
            ),
          ),
        );

  return {
    "Code change": pending("GitHub history has not provided a story read yet."),
    Decision: decisions,
    Design: designs,
    Document: documents,
    "Lifecycle change": pending(
      "Project lifecycle changes have no history read yet.",
    ),
    Milestone: milestones,
    "Production Incident": incidents,
    "Project Release": releases,
    "Validation result": validations,
    Work: works,
  } satisfies Record<StoryEventKind, Sourced>;
}

/**
 * Reads only owner records that already exist: Decisions (made and withdrawn),
 * Documents, Screens, closed Work (with the closure reason of an abandonment),
 * Milestones that were reached or abandoned, Production Incidents, Validation
 * Records with a result, and Published or Cancelled Project Releases. Project
 * lifecycle changes and GitHub code changes have no owner history read yet, so
 * they are reported as unavailable instead of being invented. Nothing here
 * writes, and no field edit is selected.
 */
export function createDatabaseProjectHistorySources(
  database: Database,
): ProjectHistorySources {
  return {
    read: (_accountId, scope) =>
      database.transaction((executor) => readKinds(executor, scope)),
    resolveScope: (accountId, input) =>
      database.transaction(async (executor) => {
        const [owned] = await executor
          .select({ id: project.id })
          .from(project)
          .innerJoin(workspace, eq(workspace.id, project.workspaceId))
          .where(
            and(
              eq(project.id, input.projectId),
              eq(workspace.ownerAccountId, accountId),
            ),
          );
        if (!owned) {
          return { status: "project-not-found" } as const;
        }
        if (input.scope === "Project") {
          return {
            scope: { kind: "Project", projectId: owned.id },
            status: "found",
          } as const;
        }
        const [feature] = await executor
          .select({
            id: work.id,
            key: work.key,
            title: work.title,
            type: work.type,
          })
          .from(work)
          .where(and(eq(work.id, input.workId), eq(work.projectId, owned.id)));
        if (!feature) {
          return { status: "work-not-found" } as const;
        }
        if (feature.type !== "Feature") {
          return { status: "work-not-feature" } as const;
        }
        return {
          scope: {
            key: feature.key,
            kind: "Feature",
            projectId: owned.id,
            title: feature.title,
            workId: feature.id,
          },
          status: "found",
        } as const;
      }),
  };
}

export function createDatabaseProjectHistory(database: Database) {
  return createProjectHistory(createDatabaseProjectHistorySources(database));
}
