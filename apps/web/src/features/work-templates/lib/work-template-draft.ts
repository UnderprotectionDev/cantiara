import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import type { WorkType } from "@cantiara/api/work-lifecycle";
import type {
  WorkTemplate,
  WorkTemplateCustomFieldValue,
} from "@cantiara/api/work-templates";

interface WorkTemplateDraft {
  checklistText: string;
  customFieldDefaults: Record<string, WorkTemplateCustomFieldValue>;
  descriptionSkeleton: string;
  name: string;
  plannedStartOffset: string;
  targetOffset: string;
  type: WorkType;
}

export const EMPTY_DRAFT: WorkTemplateDraft = {
  checklistText: "",
  customFieldDefaults: {},
  descriptionSkeleton: "",
  name: "",
  plannedStartOffset: "",
  targetOffset: "",
  type: "Task",
};

export function initialValue(
  definition: CustomFieldDefinition,
): WorkTemplateCustomFieldValue {
  switch (definition.type) {
    case "Boolean":
      return { boolean: false, kind: "boolean" };
    case "Number":
      return { kind: "number", number: 0 };
    case "Single select":
      return { kind: "option", option: definition.options[0] ?? "" };
    case "Multi select":
      return { kind: "options", options: definition.options.slice(0, 1) };
    default:
      return { kind: "text", text: "" };
  }
}

export function offset(value: string) {
  if (value.trim() === "") {
    return;
  }
  return { offsetDays: Number(value) };
}

export function draftFromTemplate(template: WorkTemplate): WorkTemplateDraft {
  return {
    checklistText: template.checklist.map((item) => item.text).join("\n"),
    customFieldDefaults: Object.fromEntries(
      template.customFieldDefaults.map((item) => [
        item.definitionId,
        item.value,
      ]),
    ),
    descriptionSkeleton: template.descriptionSkeleton ?? "",
    name: template.name,
    plannedStartOffset:
      template.relativeDates.plannedStart?.offsetDays.toString() ?? "",
    targetOffset: template.relativeDates.target?.offsetDays.toString() ?? "",
    type: template.type,
  };
}

export function relativeDatesFromDraft(draft: WorkTemplateDraft) {
  return {
    plannedStart: offset(draft.plannedStartOffset),
    target: offset(draft.targetOffset),
  };
}

export function liveCustomFieldDefaults(
  defaults: Record<string, WorkTemplateCustomFieldValue>,
  definitions: readonly CustomFieldDefinition[],
) {
  const live = new Set(definitions.map((definition) => definition.id));
  return Object.entries(defaults)
    .filter(([definitionId]) => live.has(definitionId))
    .map(([definitionId, value]) => ({ definitionId, value }));
}
