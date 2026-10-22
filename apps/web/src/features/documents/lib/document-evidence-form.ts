import {
  DOCUMENT_EVIDENCE_TARGET_TYPES,
  EVIDENCE_ROLES,
} from "@cantiara/api/document-evidence";
import { z } from "zod";

/** `Save Evidence Role` form: a closed Evidence Role and a bounded Founder interpretation. */
export const documentEvidenceRoleFormSchema = z.object({
  interpretation: z.string().max(5000),
  role: z.enum(EVIDENCE_ROLES),
});

/**
 * `Bind as evidence to existing record` and `Convert to new record and bind`
 * dialog: a record type plus an existing record or a new record title.
 */
export const documentEvidenceFormSchema = z.object({
  targetId: z.string(),
  title: z.string(),
  type: z.enum(DOCUMENT_EVIDENCE_TARGET_TYPES),
  workType: z.enum(["Task", "Bug", "Research", "Improvement"]),
});
