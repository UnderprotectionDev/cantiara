import { focusPeriodMembershipErrors } from "./focus-period-rpc-errors";
import { linkSharingRefusals } from "./link-sharing-rpc-errors";
import { personalDataErrors } from "./personal-data-rights-rpc-errors";
import { researchSessionErrors } from "./research-sessions-rpc-errors";
import { securityRedactionErrors } from "./security-redaction-rpc-errors";

export const supportReferenceRpcErrors = {
  ...focusPeriodMembershipErrors,
  ...researchSessionErrors,
  ...linkSharingRefusals,
  ...securityRedactionErrors,
  ...personalDataErrors,
};
