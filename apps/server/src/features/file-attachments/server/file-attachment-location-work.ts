import type { FileAttachmentWorkTarget } from "@cantiara/api/file-attachments";
import type { ProjectShellAccess } from "@cantiara/api/project-shell";
import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";

import type { FileAttachmentLocationWorkAccess } from "./file-attachments";

function workTarget(work: Awaited<ReturnType<WorkLifecycleAccess["find"]>>) {
  if (!work) {
    return null;
  }
  return {
    id: work.id,
    key: work.key,
    projectId: work.projectId,
    revision: work.revision,
    title: work.title,
  } satisfies FileAttachmentWorkTarget;
}

function requiredWorkTarget(
  work: Awaited<ReturnType<WorkLifecycleAccess["find"]>>,
) {
  const target = workTarget(work);
  if (!target) {
    throw new Error("Work is unavailable.");
  }
  return target;
}

export function createFileAttachmentLocationWork(
  workLifecycle: WorkLifecycleAccess,
  projects: Pick<ProjectShellAccess, "find">,
): FileAttachmentLocationWorkAccess {
  return {
    async bind(accountId, input) {
      return requiredWorkTarget(
        await workLifecycle.bindOriginPosition(accountId, {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          originPosition: input.originPosition,
          workId: input.workId,
        }),
      );
    },

    async create(accountId, input) {
      return requiredWorkTarget(
        await workLifecycle.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: input.clientIdempotencyKey,
          description: input.description,
          originPosition: input.originPosition,
          projectId: input.projectId,
          title: input.title,
          type: input.type,
        }),
      );
    },

    async find(accountId, workId) {
      return workTarget(await workLifecycle.find(accountId, workId));
    },

    async findProject(accountId, projectId) {
      return (await projects.find(accountId, projectId)) !== null;
    },

    async replayBind(accountId, input) {
      return workTarget(
        await workLifecycle.replayBindOriginPosition(accountId, input),
      );
    },
  };
}
