import { ORPCError } from "@orpc/server";

import type { Context } from "./context";
import {
  type ArchiveProjectInput,
  type DeleteProjectInput,
  PROJECT_RETIREMENT_ERROR_MESSAGES,
  type PreviewArchiveProjectInput,
  type PreviewDeleteProjectInput,
  ProjectRetirementError,
  type ProjectRetirementErrorCode,
  type RestoreProjectToArchiveInput,
  type UnarchiveProjectInput,
} from "./project-retirement";

/**
 * oRPC handler bodies of Project Retirement (spec 83). The router only names
 * the procedures and their input schemas; refusal mapping lives here.
 */

type RetirementHandlerContext = Context & {
  session: { user: { id: string } };
};

function requireProjectRetirement(context: Context) {
  if (!context.projectRetirement) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectRetirement;
}

const REFUSAL_STATUS: Record<
  ProjectRetirementErrorCode,
  "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND"
> = {
  already_archived: "CONFLICT",
  build_in_public_surface: "CONFLICT",
  empty_delete_group: "CONFLICT",
  not_archived: "CONFLICT",
  not_in_trash: "CONFLICT",
  project_in_trash: "CONFLICT",
  project_archived: "CONFLICT",
  project_not_found: "NOT_FOUND",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function refusal(error: unknown): never {
  if (error instanceof ProjectRetirementError) {
    throw new ORPCError(REFUSAL_STATUS[error.code], {
      cause: error,
      // One client code for an archived Project, the same one the shared
      // Project seam emits (`rethrowProjectShellError`).
      data: {
        code:
          error.code === "project_archived" ? "PROJECT_READ_ONLY" : error.code,
      },
      defined: true,
      message: PROJECT_RETIREMENT_ERROR_MESSAGES[error.code],
    });
  }
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && error.cause) {
    refusal(error.cause);
  }
  if (error.code === "EXTERNAL_SURFACE_STATE_INVALID") {
    // The shared External Surface path named the gap itself; a raw error
    // must not surface as an unnamed 500.
    throw new ORPCError("CONFLICT", {
      cause: error,
      data: { code: "EXTERNAL_SURFACE_STATE_INVALID" },
      defined: true,
      message: "The External Surface must be removed from its own view first.",
    });
  }
  if (
    error.code === "TRASH_ALREADY_TRASHED" ||
    error.code === "TRASH_SURFACE_NOT_REVOKED"
  ) {
    throw new ORPCError("CONFLICT", {
      data: { code: String(error.code) },
      defined: true,
      message: "Conflict",
    });
  }
  if (error.code === "TRASH_RESTORE_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: "TRASH_RESTORE_CONFLICT" },
      defined: true,
      message: "Restore needs a decision. Nothing was rebound.",
    });
  }
  if (error.code === "TRASH_KEEP_SURFACE_NOT_ALLOWED") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: "TRASH_KEEP_SURFACE_NOT_ALLOWED" },
      defined: true,
      message: "Keep approved surface is not allowed when deleting a Project.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: "CONFLICT" },
      defined: true,
      message: "Conflict",
    });
  }
  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "STALE_BASE_REVISION",
        currentRevision: error.currentRevision,
      },
      defined: true,
      message: "Current value",
    });
  }
  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      data: { code: "project_not_found" },
      defined: true,
      message: PROJECT_RETIREMENT_ERROR_MESSAGES.project_not_found,
    });
  }
  throw error;
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return refusal(error);
  }
}

export function previewArchiveProjectHandler(
  context: RetirementHandlerContext,
  input: PreviewArchiveProjectInput,
) {
  return guarded(() =>
    requireProjectRetirement(context).preview(context.session.user.id, input),
  );
}

export function archiveProjectHandler(
  context: RetirementHandlerContext,
  input: ArchiveProjectInput,
) {
  return guarded(() =>
    requireProjectRetirement(context).archive(context.session.user.id, input),
  );
}

export function previewDeleteProjectHandler(
  context: RetirementHandlerContext,
  input: PreviewDeleteProjectInput,
) {
  return guarded(() =>
    requireProjectRetirement(context).previewDelete(
      context.session.user.id,
      input,
    ),
  );
}

export function deleteProjectHandler(
  context: RetirementHandlerContext,
  input: DeleteProjectInput,
) {
  return guarded(() =>
    requireProjectRetirement(context).deleteProject(
      context.session.user.id,
      input,
    ),
  );
}

export function restoreProjectToArchiveHandler(
  context: RetirementHandlerContext,
  input: RestoreProjectToArchiveInput,
) {
  return guarded(() =>
    requireProjectRetirement(context).restoreToArchive(
      context.session.user.id,
      input,
    ),
  );
}

export function unarchiveProjectHandler(
  context: RetirementHandlerContext,
  input: UnarchiveProjectInput,
) {
  return guarded(() =>
    requireProjectRetirement(context).unarchive(context.session.user.id, input),
  );
}

export function listArchivedProjectsHandler(context: RetirementHandlerContext) {
  return guarded(() =>
    requireProjectRetirement(context).list(context.session.user.id),
  );
}
