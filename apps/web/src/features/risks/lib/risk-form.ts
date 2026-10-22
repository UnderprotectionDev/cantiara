import {
  type ProjectSourceRecord,
  RISK_LIFE_OPTIONS,
} from "@cantiara/api/project-source-records";
import { z } from "zod";

export type RiskRecord = Extract<ProjectSourceRecord, { sourceType: "Risk" }>;

const riskDraftSchema = z.object({
  description: z.string(),
  impact: z.string(),
  life: z.enum(RISK_LIFE_OPTIONS),
  probability: z.string(),
  rationale: z.string(),
  response: z.string(),
  title: z.string(),
});

/**
 * Risk editor rules in the order the founder meets them: a Title unless only
 * the Status changes, a Rationale to accept, and a different Status when
 * changing it.
 */
export function riskFormSchema({
  baseLife,
  changingStatus,
}: {
  baseLife: (typeof RISK_LIFE_OPTIONS)[number] | undefined;
  changingStatus: boolean;
}) {
  return riskDraftSchema.superRefine((draft, context) => {
    if (!(changingStatus || draft.title.trim())) {
      context.addIssue({
        code: "custom",
        message: "Enter a Title before saving.",
        path: ["title"],
      });
    }
    if (draft.life === "Accepted" && !draft.rationale.trim()) {
      context.addIssue({
        code: "custom",
        message: "Enter a Rationale before accepting a Risk.",
        path: ["rationale"],
      });
    }
    if (changingStatus && draft.life === baseLife) {
      context.addIssue({
        code: "custom",
        message: "Choose a different Status.",
        path: ["life"],
      });
    }
  });
}
