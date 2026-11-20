import { z } from "zod";
import {
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
} from "./focus-period";

import { MUTATION_UI_LABELS } from "./mutation-and-undo";
import {
  PERSONAL_DATA_ERROR_MESSAGES,
  type PersonalDataErrorCode,
} from "./personal-data-rights";
import { SECURITY_REDACTION_LOCATOR_KINDS } from "./security-redaction";

export const focusPeriodMembershipErrors = {
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT: {
    status: 409,
    message: FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
    writeOutcome: "not-written" as const,
  },
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT: {
    status: 409,
    message: FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
    writeOutcome: "not-written" as const,
  },
};

export const researchSessionErrors = {
  RESEARCH_SESSION_CHANGED: {
    status: 409,
    message: "Research Session changed. Reload before saving.",
  },
  RESEARCH_SESSION_CONSENT_REQUIRED: {
    status: 403,
    message: "Consent does not allow this Research Session operation.",
  },
};

const sharingTarget = z.object({ targetId: z.string().min(1) });
const linkSharingRefusals = {
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

export const securityRedactionErrors = {
  SECURITY_REDACTION_TYPED_NAME_MISMATCH: {
    status: 400,
    message: "The Account or Project name does not match.",
    writeOutcome: "not-written" as const,
  },
  SECURITY_REDACTION_SPREAD_INCOMPLETE: {
    status: 500,
    message: "Redaction did not reach every copy.",
    data: z.object({
      failed: z.array(z.enum(SECURITY_REDACTION_LOCATOR_KINDS)),
    }),
  },
  SECURITY_REDACTION_GRANT_REJECTED: {
    status: 403,
    message: "Confirm GitHub Identity is required to redact.",
    writeOutcome: "not-written" as const,
  },
};

export const personalDataErrors = {
  PERSONAL_DATA_CONTACT_NOT_FOUND: {
    status: 404,
    message: PERSONAL_DATA_ERROR_MESSAGES.contact_not_found,
    writeOutcome: "not-written" as const,
  },
  PERSONAL_DATA_GRANT_REJECTED: {
    status: 403,
    message: PERSONAL_DATA_ERROR_MESSAGES.grant_rejected,
    writeOutcome: "not-written" as const,
  },
  PERSONAL_DATA_NAME_MISMATCH: {
    status: 400,
    message: PERSONAL_DATA_ERROR_MESSAGES.name_mismatch,
    writeOutcome: "not-written" as const,
  },
  PERSONAL_DATA_PREVIEW_REQUIRED: {
    status: 400,
    message: PERSONAL_DATA_ERROR_MESSAGES.preview_required,
    writeOutcome: "not-written" as const,
  },
  PERSONAL_DATA_SPREAD_INCOMPLETE: {
    status: 400,
    message: PERSONAL_DATA_ERROR_MESSAGES.spread_incomplete,
  },
  PERSONAL_DATA_TOMBSTONE_INCOMPLETE: {
    status: 500,
    message: PERSONAL_DATA_ERROR_MESSAGES.tombstone_incomplete,
  },
};

export const personalDataRpcCode = {
  contact_not_found: "PERSONAL_DATA_CONTACT_NOT_FOUND",
  grant_rejected: "PERSONAL_DATA_GRANT_REJECTED",
  name_mismatch: "PERSONAL_DATA_NAME_MISMATCH",
  preview_required: "PERSONAL_DATA_PREVIEW_REQUIRED",
  spread_incomplete: "PERSONAL_DATA_SPREAD_INCOMPLETE",
  tombstone_incomplete: "PERSONAL_DATA_TOMBSTONE_INCOMPLETE",
} satisfies Record<PersonalDataErrorCode, keyof typeof personalDataErrors>;

export const supportReferenceRpcErrors = {
  ...focusPeriodMembershipErrors,
  ...researchSessionErrors,
  ...linkSharingRefusals,
  ...securityRedactionErrors,
  ...personalDataErrors,
};
