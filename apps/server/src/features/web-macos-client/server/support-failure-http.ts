import { SUPPORT_REFERENCE_HEADER } from "@cantiara/api/support-reference";
import type { EvlogVariables } from "evlog/hono";
import type { Context as HonoContext } from "hono";
import type { CreateSupportReferenceFailureOptions } from "./support-reference";
import {
  createSupportReferenceFailure,
  decorateSupportFailureResponse,
  recordSupportFailure,
  unwrapStandardRpcResponsePayload,
} from "./support-reference";

export function requestSupportReferenceId(
  context: HonoContext<EvlogVariables>,
): string | undefined {
  const { requestId } = context.get("log").getContext();
  return typeof requestId === "string" ? requestId : undefined;
}

export async function decorateAndRecordSupportFailure(
  context: HonoContext<EvlogVariables>,
  response: Response,
  options: Pick<
    CreateSupportReferenceFailureOptions,
    "error" | "retryPolicy" | "writeOutcome"
  > = {},
) {
  const requestId = requestSupportReferenceId(context);
  const decorated = await decorateSupportFailureResponse(response, {
    ...options,
    requestId,
  });

  if (decorated.status >= 400) {
    let payload: unknown;
    try {
      payload = await decorated.clone().json();
    } catch {
      payload = undefined;
    }
    payload = unwrapStandardRpcResponsePayload(payload);
    const failure = createSupportReferenceFailure({
      error: payload,
      requestId,
      supportReference:
        decorated.headers.get(SUPPORT_REFERENCE_HEADER) ?? undefined,
    });
    recordSupportFailure(context.get("log"), failure);
  }

  return decorated;
}

export function errorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }
  return 500;
}

export function isClientShellPath(path: string) {
  return path === "/rpc" || path.startsWith("/rpc/");
}
