import { linkSharingRefusals } from "@cantiara/api/link-sharing-rpc-errors";
import { isDefinedError, ORPCError } from "@orpc/client";

export function linkSharingRefusalMessage(error: unknown): string | undefined {
  if (
    error instanceof ORPCError &&
    isDefinedError(error) &&
    Object.hasOwn(linkSharingRefusals, error.code)
  ) {
    return linkSharingRefusals[error.code as keyof typeof linkSharingRefusals]
      .message;
  }
}
