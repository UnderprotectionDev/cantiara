import { z } from "zod";
import { MUTATION_UI_LABELS } from "./mutation-and-undo";

const sharingTarget = z.object({ targetId: z.string().min(1) });
export const linkSharingRefusals = {
  LINK_SHARING_EXPIRY_NOT_IN_FUTURE: {
    status: 409,
    message: "Choose an expiry in the future.",
    data: sharingTarget,
    writeOutcome: "not-written" as const,
  },
  LINK_SHARING_PLACEHOLDERS_UNRESOLVED: {
    status: 409,
    message:
      "Unresolved placeholders need a fix or a separate Publish/share anyway confirmation.",
    data: sharingTarget.extend({ count: z.int().positive() }),
    writeOutcome: "not-written" as const,
  },
  LINK_SHARING_SCOPE_INVALID: {
    status: 400,
    message:
      "This share scope is no longer available. Review the preview and try again.",
    writeOutcome: "not-written" as const,
  },
  LINK_SHARING_STATE_INVALID: {
    status: 409,
    message: "This action is unavailable for the current link state.",
    data: sharingTarget,
    writeOutcome: "not-written" as const,
  },
  LINK_SHARING_RATE_LIMITED: {
    status: 429,
    message: "Too many share changes. Try again later.",
    data: sharingTarget.extend({ retryAfterSeconds: z.int().nonnegative() }),
    writeOutcome: "not-written" as const,
  },
};

export const linkSharingErrors = {
  ...linkSharingRefusals,
  CONFLICT: {
    status: 409,
    message: MUTATION_UI_LABELS.conflict,
    data: sharingTarget.extend({ code: z.literal("CONFLICT") }),
  },
};
