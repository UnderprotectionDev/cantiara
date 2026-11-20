import {
  PERSONAL_DATA_ERROR_MESSAGES,
  type PersonalDataErrorCode,
} from "./personal-data-rights";

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
