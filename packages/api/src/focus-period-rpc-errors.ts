import {
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
} from "./focus-period";

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
