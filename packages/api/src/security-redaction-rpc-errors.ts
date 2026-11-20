import { z } from "zod";
import { SECURITY_REDACTION_LOCATOR_KINDS } from "./security-redaction";

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
