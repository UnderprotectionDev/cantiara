import type { ProjectShellMutationContracts } from "@cantiara/api/project-shell";
import {
  type ReturnContext,
  type ReturnSource,
  returnContextInputSchema,
  saveNextConcreteStepInputSchema,
} from "@cantiara/api/return-to-work";
import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import {
  projectLastVisit,
  workLastVisit,
} from "@cantiara/db/schema/return-to-work";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { createDatabaseAccountPreferences } from "../../account-preferences/server/account-preferences-database";
import { readReturnChanges } from "./return-events-database";
import { createReturnToWork } from "./return-to-work";

// The integration owns pending GitHub signals. Never infer one from a link or handoff.
export interface PendingGitHubSignals {
  workIds: (
    accountId: string,
    context: ReturnContext,
  ) => Promise<ReadonlySet<string>>;
}
export function createDatabaseReturnToWork(
  database: Database,
  dependencies: {
    projectMutations: ProjectShellMutationContracts;
    workLifecycle: WorkLifecycleAccess;
    pendingGitHubSignals?: PendingGitHubSignals;
  },
) {
  // Archived Projects and Works stay readable; writes check the archive below.
  async function requireReadableContext(
    accountId: string,
    rawContext: ReturnContext,
  ) {
    const context = returnContextInputSchema.parse(rawContext);
    const [owned] = await database
      .select({ project })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(project.id, context.projectId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    if (!owned) {
      throw new ORPCError("NOT_FOUND", { message: "Project is unavailable." });
    }
    if (context.workId) {
      const [ownedWork] = await database
        .select({ id: work.id })
        .from(work)
        .where(
          and(
            eq(work.id, context.workId),
            eq(work.projectId, context.projectId),
            isNull(work.trashedAt),
          ),
        )
        .limit(1);
      if (!ownedWork) {
        throw new ORPCError("NOT_FOUND", { message: "Work is unavailable." });
      }
    }
    return owned.project;
  }
  const preferences = createDatabaseAccountPreferences(database);
  return createReturnToWork({
    readTimeZone: async (accountId) =>
      (await preferences.get(accountId)).timeZone,
    async read(accountId, context) {
      const currentProject = await requireReadableContext(accountId, context);
      const [projectVisit] = await database
        .select()
        .from(projectLastVisit)
        .where(
          and(
            eq(projectLastVisit.accountId, accountId),
            eq(projectLastVisit.projectId, context.projectId),
          ),
        );
      const works = await database
        .select({ work, viewedAt: workLastVisit.viewedAt })
        .from(work)
        .leftJoin(
          workLastVisit,
          and(
            eq(workLastVisit.workId, work.id),
            eq(workLastVisit.accountId, accountId),
          ),
        )
        .where(
          and(
            eq(work.projectId, context.projectId),
            isNull(work.trashedAt),
            // The context Work stays a readable source even while archived;
            // card candidates without an explicit context skip archived Work.
            context.workId
              ? eq(work.id, context.workId)
              : isNull(work.archivedAt),
          ),
        );
      const risks = context.workId
        ? []
        : await database
            .select()
            .from(risk)
            .where(eq(risk.projectId, context.projectId));
      const pending =
        (await dependencies.pendingGitHubSignals?.workIds(
          accountId,
          context,
        )) ?? new Set<string>();
      const projectPath = `/projects/${encodeURIComponent(context.projectId)}`;
      const sources: ReturnSource[] = [];
      if (!context.workId) {
        sources.push({
          id: currentProject.id,
          projectId: currentProject.id,
          recordType: "Project",
          title: currentProject.name,
          sourcePath: `${projectPath}#overview`,
          revision: currentProject.revision,
          updatedAt: currentProject.updatedAt.toISOString(),
          targetDate: currentProject.targetDate,
          lastViewedAt: projectVisit?.viewedAt.toISOString() ?? null,
          openRisk: false,
          pendingGitHubSignal: false,
          nextConcreteStep: currentProject.nextConcreteStep,
          nextConcreteStepUpdatedAt:
            currentProject.nextConcreteStepUpdatedAt?.toISOString() ?? null,
        });
      }
      for (const { work: record, viewedAt } of works) {
        sources.push({
          id: record.id,
          projectId: record.projectId,
          recordType: "Work",
          title: `${record.key} · ${record.title}`,
          sourcePath: `${projectPath}#work-${encodeURIComponent(record.id)}`,
          revision: record.revision,
          updatedAt: record.updatedAt.toISOString(),
          targetDate: record.targetDate,
          lastViewedAt: viewedAt?.toISOString() ?? null,
          openRisk: false,
          pendingGitHubSignal: pending.has(record.id),
          nextConcreteStep: record.nextConcreteStep,
          nextConcreteStepUpdatedAt:
            record.nextConcreteStepUpdatedAt?.toISOString() ?? null,
        });
      }
      for (const record of risks) {
        sources.push({
          id: record.id,
          projectId: record.projectId,
          recordType: "Risk",
          title: record.title,
          sourcePath: `${projectPath}#source-risk-${encodeURIComponent(record.id)}`,
          revision: record.revision,
          updatedAt: record.updatedAt.toISOString(),
          targetDate: null,
          lastViewedAt: null,
          openRisk: record.life === "Open" || record.life === "Mitigating",
          pendingGitHubSignal: false,
          nextConcreteStep: null,
          nextConcreteStepUpdatedAt: null,
        });
      }
      return { readOnly: currentProject.archivedAt !== null, sources };
    },
    async readChanges(accountId, context) {
      await requireReadableContext(accountId, context);
      return readReturnChanges(database, accountId, context);
    },
    async saveNextStep(accountId, rawInput) {
      const input = saveNextConcreteStepInputSchema.parse(rawInput);
      const currentProject = await requireReadableContext(accountId, {
        projectId: input.projectId,
        ...(input.workId ? { workId: input.workId } : {}),
      });
      if (currentProject.archivedAt !== null) {
        throw new ORPCError("NOT_FOUND", { message: "Project is read-only." });
      }
      if (input.workId) {
        await dependencies.workLifecycle.updateFields(accountId, {
          workId: input.workId,
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          fields: { nextConcreteStep: input.nextConcreteStep },
        });
        return;
      }
      await dependencies.projectMutations.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { nextConcreteStep: input.nextConcreteStep },
          targetId: input.projectId,
        },
        ({ committedAt, currentRevision, currentValue }) => {
          if (!currentValue.project) {
            throw new ORPCError("NOT_FOUND");
          }
          return {
            project: {
              ...currentValue.project,
              nextConcreteStep: input.nextConcreteStep,
              nextConcreteStepUpdatedAt: committedAt,
              revision: currentRevision + 1,
              updatedAt: committedAt,
            },
          };
        },
      );
    },
    async markViewed(accountId, context) {
      await requireReadableContext(accountId, context);
      const viewedAt = new Date();
      if (context.workId) {
        await database
          .insert(workLastVisit)
          .values({ accountId, workId: context.workId, viewedAt })
          .onConflictDoUpdate({
            target: [workLastVisit.accountId, workLastVisit.workId],
            set: { viewedAt },
          });
      } else {
        await database
          .insert(projectLastVisit)
          .values({ accountId, projectId: context.projectId, viewedAt })
          .onConflictDoUpdate({
            target: [projectLastVisit.accountId, projectLastVisit.projectId],
            set: { viewedAt },
          });
      }
    },
  });
}
