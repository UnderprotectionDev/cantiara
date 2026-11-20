import { ORPCError, type ORPCErrorConstructorMap } from "@orpc/server";
import {
  LinkSharingConflictError,
  LinkSharingExpiryError,
  LinkSharingPlaceholdersError,
  LinkSharingRateLimitError,
  LinkSharingScopeError,
  LinkSharingStateError,
} from "./link-sharing";
import type { linkSharingErrors } from "./link-sharing-rpc-errors";

export async function linkSharingWrite<T>(
  errors: ORPCErrorConstructorMap<typeof linkSharingErrors>,
  targetId: string,
  write: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await write();
    if (!result) {
      throw new ORPCError("NOT_FOUND");
    }
    return result;
  } catch (error) {
    if (error instanceof LinkSharingConflictError) {
      throw errors.CONFLICT({
        cause: error,
        data: { code: "CONFLICT", targetId },
      });
    }
    if (error instanceof LinkSharingPlaceholdersError) {
      throw errors.LINK_SHARING_PLACEHOLDERS_UNRESOLVED({
        cause: error,
        data: { count: error.findings.length, targetId },
      });
    }
    if (error instanceof LinkSharingScopeError) {
      throw errors.LINK_SHARING_SCOPE_INVALID({ cause: error });
    }
    if (error instanceof LinkSharingExpiryError) {
      throw errors.LINK_SHARING_EXPIRY_NOT_IN_FUTURE({
        cause: error,
        data: { targetId },
      });
    }
    if (error instanceof LinkSharingStateError) {
      throw errors.LINK_SHARING_STATE_INVALID({
        cause: error,
        data: { targetId },
      });
    }
    if (error instanceof LinkSharingRateLimitError) {
      throw errors.LINK_SHARING_RATE_LIMITED({
        cause: error,
        data: { retryAfterSeconds: error.retryAfterSeconds, targetId },
      });
    }
    throw error;
  }
}
