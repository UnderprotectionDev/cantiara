import { ORPCError } from "@orpc/server";

import type { Context } from "./context";
import {
  type ArchiveProjectInput,
  PROJECT_RETIREMENT_ERROR_MESSAGES,
  type PreviewArchiveProjectInput,
  ProjectRetirementError,
  type ProjectRetirementErrorCode,
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
  not_archived: "CONFLICT",
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
      data: { code: error.code },
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
