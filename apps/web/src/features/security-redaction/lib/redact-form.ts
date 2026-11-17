import { applySecurityRedactionInputSchema } from "@cantiara/api/security-redaction";
import { z } from "zod";

/**
 * The `Redact` confirmation values the form submits: the typed Account or
 * Project name must equal the previewed target and the audit reason is
 * required (`Redact` stays disabled until both hold). The field rules come from the apply input schema; the grant,
 * scope and value travel in the review state, not the form.
 */
export function redactFormSchema(expectedName: string) {
  return z.object({
    reason: z
      .string()
      .trim()
      .pipe(applySecurityRedactionInputSchema.shape.reason),
    typedName: z
      .string()
      .refine((typedName) => typedName === expectedName)
      .pipe(applySecurityRedactionInputSchema.shape.typedName),
  });
}
