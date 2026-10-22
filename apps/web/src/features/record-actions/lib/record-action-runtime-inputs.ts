import {
  customFieldValuePayloadSchema,
  type ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import type { RecordAction } from "@cantiara/api/record-actions";
import { z } from "zod";

/** The runtime-input form as the dialog holds it before it is submitted. */
interface RuntimeInputDraft {
  customFieldValues: Record<string, ParsedCustomFieldValuePayload | undefined>;
  relations: Record<string, string | undefined>;
}

export const EMPTY_RUNTIME_INPUT_DRAFT: RuntimeInputDraft = {
  customFieldValues: {},
  relations: {},
};

/**
 * Form schema of one Record Action's runtime inputs: every runtime-input
 * Custom field value and every related Work step needs a value. Its output is
 * the `RecordActionRuntimeInputs` the preview command sends.
 */
export function recordActionRuntimeInputsFormSchema(action: RecordAction) {
  const customFieldValues: Record<
    string,
    typeof customFieldValuePayloadSchema
  > = {};
  const relations: Record<string, z.ZodString> = {};
  for (const step of action.steps) {
    if (
      step.kind === "custom-field-value" &&
      step.value.kind === "runtime-input"
    ) {
      customFieldValues[step.definitionId] = customFieldValuePayloadSchema;
    } else if (step.kind === "related-work") {
      relations[step.inputId] = z.string().min(1);
    }
  }
  return z
    .object({
      customFieldValues: z.object(customFieldValues),
      relations: z.object(relations),
    })
    .transform((value) => ({
      customFieldValues: value.customFieldValues as Record<
        string,
        ParsedCustomFieldValuePayload
      >,
      relations: Object.fromEntries(
        Object.entries(value.relations).map(([inputId, recordId]) => [
          inputId,
          { recordId, recordType: "Work" as const },
        ]),
      ),
    }));
}
