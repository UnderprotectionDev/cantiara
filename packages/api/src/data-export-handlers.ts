import { ORPCError } from "@orpc/server";

import type { Context } from "./context";
import {
  EXPORT_ERROR_MESSAGES,
  ExportError,
  type ExportProduceInput,
  type ExportRequest,
} from "./data-export";

/**
 * oRPC handler bodies for Selected Export (spec 79). The router only names the
 * procedures and their input schemas; refusal mapping lives here so the router
 * stays a thin adapter.
 */

function requireSelectedExport(context: Context) {
  if (!context.selectedExport) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.selectedExport;
}

/** Selected Export refusals keep a stable `data.code` the Export surface shows. */
export async function exportRefusal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ExportError) {
      throw new ORPCError(
        error.code === "capacity_exceeded"
          ? "TOO_MANY_REQUESTS"
          : "BAD_REQUEST",
        {
          cause: error,
          data: { code: error.code },
          defined: true,
          message: error.detail ?? EXPORT_ERROR_MESSAGES[error.code],
        },
      );
    }
    throw error;
  }
}

type ExportHandlerContext = Context & { session: { user: { id: string } } };

export function exportCatalogHandler(context: Context) {
  return requireSelectedExport(context).catalog();
}

export function exportPreviewHandler(
  context: ExportHandlerContext,
  input: ExportRequest,
) {
  return exportRefusal(() =>
    requireSelectedExport(context).preview(context.session.user.id, input),
  );
}

export function exportProduceHandler(
  context: ExportHandlerContext,
  input: ExportProduceInput,
) {
  return exportRefusal(() =>
    requireSelectedExport(context).produce(context.session.user.id, input),
  );
}
