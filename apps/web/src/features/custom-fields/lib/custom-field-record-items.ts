import type {
  CustomFieldDefinition,
  CustomFieldValueListItem,
  CustomFieldValueRecord,
} from "@cantiara/api/custom-fields";

function projectValueItems(
  projectValues: {
    definitions: CustomFieldDefinition[];
    values: CustomFieldValueRecord[];
  },
  recordId: string,
): CustomFieldValueListItem[] {
  return projectValues.definitions.map((definition) => ({
    definition,
    value:
      projectValues.values.find(
        (candidate) =>
          candidate.definitionId === definition.id &&
          candidate.recordId === recordId,
      ) ?? null,
  }));
}

export function customFieldItemsForRecord(
  projectValues:
    | {
        definitions: CustomFieldDefinition[];
        values: CustomFieldValueRecord[];
      }
    | undefined,
  recordId: string,
): CustomFieldValueListItem[] {
  if (!projectValues) {
    return [];
  }
  return projectValueItems(projectValues, recordId);
}
