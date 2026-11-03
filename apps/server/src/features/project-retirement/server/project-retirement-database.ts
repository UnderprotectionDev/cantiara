import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "@cantiara/api/mutation-contract-database";
import {
  type InFlightWork,
  PROJECT_LIFECYCLE_STATUSES,
  ProjectRetirementError,
  type RetirementProject,
} from "@cantiara/api/project-retirement";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { dataImportStaging } from "@cantiara/db/schema/data-import";
import { fileAttachmentUpload } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { workAutomationRule } from "@cantiara/db/schema/work-automation";
import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";

import type {
  ProjectRetirementStore,
  RetirementIntegration,
  RetirementTransition,
} from "./project-retirement";

interface RetirementValue {
  project: RetirementProject | null;
}

type ProjectRow = typeof project.$inferSelect;

function toRetirementProject(row: ProjectRow): RetirementProject {
  const status = PROJECT_LIFECYCLE_STATUSES.find(
    (candidate) => candidate === row.status,
  );
  if (!status) {
    throw new Error("The Project has an unknown life-cycle status.");
  }
  return {
    archivedAt: row.archivedAt?.toISOString() ?? null,
    id: row.id,
    name: row.name,
    revision: row.revision,
    shortCode: row.shortCode,
    status,
  };
}

async function ownedWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [row] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return row?.id ?? null;
}

async function findOwned(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const workspaceId = await ownedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }
  const query = executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

function toTarget(row: ProjectRow): MutationTarget<RetirementValue> {
  return {
    id: row.id,
    revision: row.revision,
    value: { project: toRetirementProject(row) },
  };
}

/**
 * The archive column on the shared revision barrier. Only `archived_at` and
 * the revision move: the life-cycle status, the Trash columns and every
 * child record stay as they are.
 */
function archiveTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<RetirementValue> {
  return {
    async find(executor, targetId, lock) {
      const row = await findOwned(executor, accountId, targetId, lock);
      return row ? toTarget(row) : null;
    },

    async update(executor, input) {
      const next = input.nextValue.project;
      const owned = await findOwned(executor, accountId, input.targetId, true);
      if (!(next && owned) || owned.id !== next.id) {
        return null;
      }
      const [updated] = await executor
        .update(project)
        .set({
          archivedAt: next.archivedAt ? new Date(next.archivedAt) : null,
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(project.id, owned.id),
            eq(project.workspaceId, owned.workspaceId),
            eq(project.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated ? toTarget(updated) : null;
    },
  };
}

export function createDatabaseProjectRetirementStore(
  database: Database,
  options: { now?: () => Date } = {},
): ProjectRetirementStore {
  const now = options.now ?? (() => new Date());
  return {
    async find(accountId, projectId) {
      const row = await findOwned(database, accountId, projectId, false);
      return row ? toRetirementProject(row) : null;
    },

    async listArchived(accountId) {
      const workspaceId = await ownedWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      const rows = await database
        .select()
        .from(project)
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            isNotNull(project.archivedAt),
          ),
        )
        .orderBy(desc(project.archivedAt));
      return rows.map(toRetirementProject);
    },

    async transition(accountId, input: RetirementTransition) {
      const contract = createDatabaseMutationContract<RetirementValue>(
        database,
        { target: archiveTarget(accountId) },
      );
      const receipt = await contract.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { archived: input.archived },
          targetId: input.projectId,
        },
        ({ currentRevision, currentValue, payload }) => {
          const current = currentValue.project;
          if (!current) {
            throw new ProjectRetirementError("project_not_found");
          }
          if (payload.archived && current.archivedAt) {
            throw new ProjectRetirementError("already_archived");
          }
          if (!(payload.archived || current.archivedAt)) {
            throw new ProjectRetirementError("not_archived");
          }
          return {
            project: {
              ...current,
              archivedAt: payload.archived ? now().toISOString() : null,
              revision: currentRevision + 1,
            },
          } satisfies RetirementValue;
        },
      );
      return receipt.nextValue.project;
    },
  };
}

function importScopeProjectId(request: Record<string, unknown>) {
  const { scope } = request;
  if (scope && typeof scope === "object") {
    const { kind, projectId } = scope as Record<string, unknown>;
    return kind === "project" && typeof projectId === "string"
      ? projectId
      : null;
  }
  return null;
}

/**
 * The exact state of work that is still moving: a staged or applying import,
 * a staged upload, an enabled automation rule and each GitHub link. The
 * archive stops them; this only reports what each one is doing now.
 */
export function createDatabaseInFlightWork(
  database: Database,
  deps: {
    integrations: (
      accountId: string,
      projectId: string,
    ) => Promise<RetirementIntegration[]>;
    now?: () => Date;
  },
) {
  const now = deps.now ?? (() => new Date());
  return async function inFlight(
    accountId: string,
    projectId: string,
  ): Promise<InFlightWork[]> {
    const [imports, uploads, rules, links] = await Promise.all([
      database
        .select({
          applyingKey: dataImportStaging.applyingKey,
          request: dataImportStaging.request,
        })
        .from(dataImportStaging)
        .where(
          and(
            eq(dataImportStaging.accountId, accountId),
            gt(dataImportStaging.expiresAt, now()),
          ),
        ),
      database
        .select({ fileName: fileAttachmentUpload.fileName })
        .from(fileAttachmentUpload)
        .where(
          and(
            eq(fileAttachmentUpload.accountId, accountId),
            eq(fileAttachmentUpload.projectId, projectId),
            eq(fileAttachmentUpload.status, "staged"),
            gt(fileAttachmentUpload.expiresAt, now()),
          ),
        ),
      database
        .select({ name: workAutomationRule.name })
        .from(workAutomationRule)
        .where(
          and(
            eq(workAutomationRule.projectId, projectId),
            eq(workAutomationRule.enabled, true),
            isNull(workAutomationRule.trashedAt),
          ),
        ),
      deps.integrations(accountId, projectId),
    ]);
    return [
      ...imports
        .filter((row) => importScopeProjectId(row.request) === projectId)
        .map((row) => ({
          kind: "Import" as const,
          state: row.applyingKey ? "Applying" : "Previewed, not applied",
        })),
      ...uploads.map((row) => ({
        kind: "Upload" as const,
        state: `Staged: ${row.fileName}`,
      })),
      ...rules.map((row) => ({
        kind: "Automation" as const,
        state: `Enabled: ${row.name}`,
      })),
      ...links.map((link) => ({
        kind: "GitHub sync" as const,
        state: `${link.label}: ${link.state}`,
      })),
    ];
  };
}
